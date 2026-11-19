// src/modules/vivi-integration/application/use-cases/leads-vivi.use-cases.ts
// Fatia 3 (WhatsApp do corretor): o corretor ve os leads que a VIVI passou
// para ele (roleta), le a conversa da VIVI com o cliente (so leitura, via
// Chatwoot) e continua o atendimento. Ate 19/11/2026 isso era so pelo WhatsApp
// do proprio corretor (decisao de 03/10); desde a Etapa 1 parte 3 o corretor
// DONO do lead tambem pode escrever pelo numero oficial (enviarMensagem) -
// a gestao so le (decisoes do Villar, 16/10 e 19/11/2026).
//
// Escopo: Administrador e cargos de escopo "todos" (diretor, diretor
// regional) veem os leads de todos; os demais, so os proprios.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';
import { LeadsViviRepository, ORIGENS_VIVI } from '../../infra/database/leads-vivi.repository';
import { ChatwootWhatsappService } from '../../services/chatwoot-whatsapp.service';
import { ChatwootMensagemRepository } from '../../infra/database/chatwoot-mensagem.repository';
import { chaveTelefone } from '../../../vendas_kanban/domain/services/telefone';

// O cliente ve so o nome da empresa no numero oficial: a mensagem sai com o
// primeiro nome do corretor em negrito na 1a linha (decisao do Villar, 19/11).
export function comNomeDoCorretor(nomeCompleto: string | null, texto: string): string {
  const primeiro = (nomeCompleto ?? '').trim().split(/\s+/)[0]?.replace(/[*_~`]/g, '');
  return primeiro ? `*${primeiro}*\n${texto}` : texto;
}

export interface Solicitante {
  tenantId: string;
  userId: string;
  role: string;
  cargo: string | null;
}

const veTodos = (s: Solicitante) => resolveEscopo(s.role, s.cargo) === 'todos';

@Injectable()
export class LeadsViviUseCases {
  private readonly logger = new Logger(LeadsViviUseCases.name);

  constructor(
    private readonly repo: LeadsViviRepository,
    private readonly chatwoot: ChatwootWhatsappService,
    private readonly mensagens: ChatwootMensagemRepository,
  ) {}

  async listar(s: Solicitante, corretorId?: string) {
    const todos = veTodos(s);
    const ownerId = todos ? corretorId || null : s.userId;
    const leads = await this.repo.listar({ tenantId: s.tenantId, ownerId, limite: 200 });
    return { leads, veTodos: todos };
  }

  private async cardPermitido(s: Solicitante, cardId: string) {
    const card = await this.repo.findCard(cardId, s.tenantId);
    if (!card || !ORIGENS_VIVI.includes(card.origem)) throw new NotFoundException('Lead nao encontrado.');
    if (!veTodos(s) && card.ownerId !== s.userId) throw new ForbiddenException('Este lead nao esta com voce.');
    return card;
  }

  async conversa(s: Solicitante, cardId: string) {
    const card = await this.cardPermitido(s, cardId);
    if (!card.phone) return { encontrado: false, conversaUrl: null, status: null, mensagens: [], erro: null };
    try {
      return { ...(await this.chatwoot.historicoPorTelefone(card.phone)), erro: null };
    } catch (err) {
      this.logger.warn(`Falha ao ler a conversa da VIVI do card ${cardId}: ${(err as Error).message}`);
      return {
        encontrado: false,
        conversaUrl: null,
        status: null,
        mensagens: [],
        erro: 'Nao foi possivel carregar a conversa da VIVI agora. Tente de novo em instantes.',
      };
    }
  }

  // Etapa 1, parte 3: so o corretor DONO do lead escreve (a gestao so le).
  async enviarMensagem(s: Solicitante, cardId: string, textoBruto: string) {
    const card = await this.repo.findCard(cardId, s.tenantId);
    if (!card || !ORIGENS_VIVI.includes(card.origem)) throw new NotFoundException('Lead nao encontrado.');
    if (card.ownerId !== s.userId) throw new ForbiddenException('So o corretor responsavel pelo lead pode enviar mensagens.');
    if (!card.phone) throw new UnprocessableEntityException('Este lead nao tem telefone.');
    const texto = textoBruto.trim();
    if (!texto) throw new BadRequestException('Escreva a mensagem.');

    const nome = await this.repo.nomeUsuario(s.userId);
    const corpo = comNomeDoCorretor(nome, texto);
    const r = await this.chatwoot.enviarParaCliente(card.phone, corpo);
    if (!r.ok) {
      if (r.motivo === 'fora_da_janela') {
        throw new UnprocessableEntityException(
          'O cliente esta ha mais de 24 h sem responder. Pelo WhatsApp oficial, so e possivel enviar um modelo aprovado pela Meta (proxima etapa). Por enquanto, use o seu WhatsApp.',
        );
      }
      if (r.motivo === 'sem_conversa') {
        throw new UnprocessableEntityException('Este cliente ainda nao tem conversa no numero oficial.');
      }
      throw new ServiceUnavailableException('Nao foi possivel enviar agora. Tente de novo em instantes.');
    }

    await this.mensagens.registrarEnvio({
      tenantId: s.tenantId,
      cardId: card.id,
      telefone: card.phone,
      telefoneChave: chaveTelefone(card.phone) ?? card.phone,
      chatwootMessageId: r.chatwootMessageId,
      chatwootConversationId: r.conversaId,
      chatwootInboxId: r.inboxId,
      direcao: 'saida',
      autorTipo: 'atendente',
      autorNome: nome,
      autorUserId: s.userId,
      conteudo: corpo,
      anexos: [],
      enviadaEm: r.enviadaEm,
    });
    return { ok: true, enviadaEm: r.enviadaEm };
  }

  async registrarContato(s: Solicitante, cardId: string) {
    await this.cardPermitido(s, cardId);
    const nome = await this.repo.nomeUsuario(s.userId);
    const quando = await this.repo.registrarContatoWhatsapp(s.tenantId, cardId, nome);
    return { ultimoContatoEm: quando };
  }
}
