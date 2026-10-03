// src/modules/vivi-integration/application/use-cases/leads-vivi.use-cases.ts
// Fatia 3 (WhatsApp do corretor): o corretor ve os leads que a VIVI passou
// para ele (roleta), le a conversa da VIVI com o cliente (so leitura, via
// Chatwoot) e continua o atendimento pelo PROPRIO WhatsApp. Nada aqui envia
// mensagem nem mexe na conversa da VIVI (decisao do Villar, 03/10/2026).
//
// Escopo: Administrador e cargos de escopo "todos" (diretor, diretor
// regional) veem os leads de todos; os demais, so os proprios.
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';
import { LeadsViviRepository, ORIGENS_VIVI } from '../../infra/database/leads-vivi.repository';
import { ChatwootWhatsappService } from '../../services/chatwoot-whatsapp.service';

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

  async registrarContato(s: Solicitante, cardId: string) {
    await this.cardPermitido(s, cardId);
    const nome = await this.repo.nomeUsuario(s.userId);
    const quando = await this.repo.registrarContatoWhatsapp(s.tenantId, cardId, nome);
    return { ultimoContatoEm: quando };
  }
}
