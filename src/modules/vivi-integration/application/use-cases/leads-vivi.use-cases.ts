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
  ConflictException,
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

// Etapa 3 (19/11/2026): regras da caixa de envio da tela de chat.
export const JANELA_WHATSAPP_MS = 24 * 60 * 60 * 1000;
export const INTERVALO_SINCRONIA_MS = 2 * 60 * 1000;

export type MotivoEnvio = 'ok' | 'somente_leitura' | 'aguardando_aceite' | 'fora_da_janela' | 'sem_mensagem_do_cliente';

export function estadoDoEnvio(p: {
  souDono: boolean;
  aguardandoAceite: boolean;
  ultimaDoCliente: Date | null;
  agora: Date;
}): { podeEnviar: boolean; motivo: MotivoEnvio; janelaFechaEm: Date | null } {
  const janelaFechaEm = p.ultimaDoCliente ? new Date(p.ultimaDoCliente.getTime() + JANELA_WHATSAPP_MS) : null;
  let motivo: MotivoEnvio = 'ok';
  if (!p.souDono) motivo = 'somente_leitura';
  else if (p.aguardandoAceite) motivo = 'aguardando_aceite';
  else if (!janelaFechaEm) motivo = 'sem_mensagem_do_cliente';
  else if (janelaFechaEm.getTime() <= p.agora.getTime()) motivo = 'fora_da_janela';
  return { podeEnviar: motivo === 'ok', motivo, janelaFechaEm };
}

// Mensagens internas do fazer.ai que vazam como texto (ex.: comando de teste).
export function ehMensagemInterna(conteudo: string | null): boolean {
  return /^\s*modo teste (ativado|desativado)/i.test(conteudo ?? '');
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

  // Ultima sincronia com o Chatwoot por card (memoria do processo).
  private readonly sincronizadoEm = new Map<string, number>();

  async listar(s: Solicitante, corretorId?: string) {
    const todos = veTodos(s);
    const ownerId = todos ? corretorId || null : s.userId;
    const base = await this.repo.listar({ tenantId: s.tenantId, ownerId, limite: 200 });
    const resumo = await this.mensagens.resumoPorCard(
      base.map((l) => l.id),
      s.userId,
    );
    const leads = base.map((l) => {
      const r = resumo.get(l.id);
      const ultima = r?.ultima && !ehMensagemInterna(r.ultima.texto) ? r.ultima : null;
      return { ...l, ultimaMensagem: ultima, naoLidas: r?.naoLidas ?? 0 };
    });
    return { leads, veTodos: todos };
  }

  // Etapa 3: conversa para a tela de chat, lida do banco do Gestor (o webhook
  // grava cada mensagem na hora). Ao abrir (sem `desde`), completa o banco
  // com o historico do Chatwoot - no maximo a cada 2 min por card - para
  // trazer o que chegou antes do webhook. A atualizacao automatica da tela
  // manda `desde` e so le o banco (barato, sem chamar o Chatwoot).
  async conversaChat(s: Solicitante, cardId: string, desde?: Date) {
    const card = await this.cardPermitido(s, cardId);
    const detalhe = await this.repo.detalheParaChat(cardId, s.tenantId);
    if (!detalhe) throw new NotFoundException('Lead nao encontrado.');
    const agora = new Date();
    let erroSincronia: string | null = null;
    if (!desde && card.phone) erroSincronia = await this.sincronizar(s.tenantId, card.id, card.phone, agora);

    const linhas = (await this.mensagens.daConversa(card.id, desde)).filter((m) => !ehMensagemInterna(m.conteudo));
    const mensagens = linhas.map((m) => ({
      id: m.chatwootMessageId,
      direcao: m.direcao,
      autor: m.autorTipo,
      autorNome: m.autorTipo === 'atendente' ? m.autorNome : m.autorTipo === 'vivi' ? 'VIVI' : m.autorNome,
      texto: m.conteudo,
      anexos: Array.isArray(m.anexos) ? m.anexos : [],
      quando: m.enviadaEm,
      gravadaEm: m.createdAt,
    }));

    const aguardandoAceite = !!detalhe.atribuidoAutomaticamenteEm && !detalhe.aceitoEm;
    const ultimaDoCliente = await this.mensagens.ultimaDoCliente(card.id);
    const envio = estadoDoEnvio({ souDono: card.ownerId === s.userId, aguardandoAceite, ultimaDoCliente, agora });
    // A passagem da VIVI (Etapa 2) ja diz quem assumiu; sem ela, mostra o aceite.
    const passagens = detalhe.activities.map((a) => ({ tipo: 'passagem', texto: a.subject ?? '', quando: a.createdAt }));
    const eventos = passagens.length
      ? passagens
      : detalhe.aceitoEm
        ? [{ tipo: 'aceite', texto: 'Lead aceito', quando: detalhe.aceitoEm }]
        : [];
    return {
      mensagens,
      eventos,
      envio: {
        ...envio,
        prazoAceiteAte:
          aguardandoAceite && detalhe.atribuidoAutomaticamenteEm
            ? new Date(detalhe.atribuidoAutomaticamenteEm.getTime() + detalhe.timeoutAceiteMinutos * 60_000)
            : null,
        corretorJaEscreveu: await this.mensagens.corretorJaEscreveu(card.id),
      },
      agora,
      erro: erroSincronia,
    };
  }

  private async sincronizar(tenantId: string, cardId: string, telefone: string, agora: Date): Promise<string | null> {
    const ultima = this.sincronizadoEm.get(cardId) ?? 0;
    if (agora.getTime() - ultima < INTERVALO_SINCRONIA_MS) return null;
    try {
      const chave = chaveTelefone(telefone) ?? telefone;
      const historico = await this.chatwoot.historicoParaGravar(telefone);
      const novas = await this.mensagens.inserirVarias(
        historico.map((m) => ({ ...m, tenantId, cardId, telefoneChave: chave })),
      );
      await this.mensagens.ligarSemCardAoCard(tenantId, chave, cardId);
      if (novas > 0) this.logger.log(`Card ${cardId}: ${novas} mensagem(ns) do Chatwoot completada(s) no Gestor.`);
      this.sincronizadoEm.set(cardId, agora.getTime());
      return null;
    } catch (err) {
      this.logger.warn(`Falha ao completar o historico do card ${cardId}: ${(err as Error).message}`);
      return 'Parte do historico antigo pode nao aparecer agora (Chatwoot fora do ar). As mensagens novas continuam chegando.';
    }
  }

  async marcarLido(s: Solicitante, cardId: string) {
    await this.cardPermitido(s, cardId);
    const agora = new Date();
    await this.mensagens.marcarLido(s.userId, cardId, agora);
    return { lidoAte: agora };
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
    // Etapa 3: antes do aceite a VIVI ainda atende (decisao do Villar, 19/11).
    if (await this.repo.aguardandoAceite(card.id, s.tenantId)) {
      throw new ConflictException('Aceite o lead para responder. Ate o aceite, a VIVI continua atendendo o cliente.');
    }
    const texto = textoBruto.trim();
    if (!texto) throw new BadRequestException('Escreva a mensagem.');

    const nome = await this.repo.nomeUsuario(s.userId);
    const corpo = comNomeDoCorretor(nome, texto);
    const r = await this.chatwoot.enviarParaCliente(card.phone, corpo);
    if (!r.ok) {
      if (r.motivo === 'fora_da_janela') {
        throw new UnprocessableEntityException(
          'O cliente esta ha mais de 24 h sem responder. Pelo WhatsApp oficial, so e possivel retomar com um modelo aprovado pela Meta (proxima etapa). Se for urgente, ligue para o cliente.',
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
