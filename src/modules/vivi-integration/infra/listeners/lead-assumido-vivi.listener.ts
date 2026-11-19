// WhatsApp integrado - Etapa 2 (19/11/2026): quando um humano passa a ser o
// dono DEFINITIVO do lead (aceite na Roleta, sugestao confirmada, "iniciar
// atendimento" ou escalada para a gestao), a conversa do cliente no numero
// oficial passa da VIVI para o Gestor (conta de servico no Chatwoot) - a VIVI
// e os lembretes dela param, e o corretor continua pelo Gestor.
// Ate o aceite a VIVI segue respondendo (decisao do Villar, opcao A).
//
// Nao trava quem emitiu (o aceite nunca falha por causa do Chatwoot).
// Falha de rede/Chatwoot: tenta 3 vezes (agora, +30 s, +2 min). Se ainda
// falhar, deixa uma tarefa em aberto no card. Redes de seguranca que ja
// existem: a VIVI se cala sozinha quando o Gestor responde "com_corretor", e
// a primeira mensagem do corretor pelo Gestor tambem passa a conversa.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LEAD_ASSUMIDO_EVENT, LeadAssumidoEvent } from '../../../vendas_kanban/domain/events/lead-assumido.event';
import { chaveTelefone } from '../../../vendas_kanban/domain/services/telefone';
import { ChatwootWhatsappService } from '../../services/chatwoot-whatsapp.service';
import { LeadsViviRepository } from '../database/leads-vivi.repository';
import { ChatwootMensagemRepository } from '../database/chatwoot-mensagem.repository';

export const ESPERAS_NOVA_TENTATIVA_MS = [30_000, 120_000];

export type ResultadoListener = 'passada' | 'sem_conversa' | 'sem_telefone' | 'nao_configurado' | 'falhou';

@Injectable()
export class LeadAssumidoViviListener {
  private readonly logger = new Logger(LeadAssumidoViviListener.name);
  // Substituivel nos testes (sem esperar de verdade).
  esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  constructor(
    private readonly chatwoot: ChatwootWhatsappService,
    private readonly leads: LeadsViviRepository,
    private readonly mensagens: ChatwootMensagemRepository,
  ) {}

  @OnEvent(LEAD_ASSUMIDO_EVENT)
  async aoAssumirLead(evento: LeadAssumidoEvent): Promise<ResultadoListener> {
    try {
      return await this.passar(evento);
    } catch (err: any) {
      // Listener nunca derruba o processo.
      this.logger.error(`Falha inesperada ao passar a conversa do card ${evento.cardId}: ${err?.message ?? err}`);
      return 'falhou';
    }
  }

  private async passar(evento: LeadAssumidoEvent): Promise<ResultadoListener> {
    const card = await this.leads.findCard(evento.cardId, evento.tenantId);
    const chave = chaveTelefone(card?.phone);
    if (!card?.phone || !chave) return 'sem_telefone';

    const ligadas = await this.mensagens.ligarSemCardAoCard(evento.tenantId, chave, card.id);
    if (ligadas > 0) this.logger.log(`${ligadas} mensagem(ns) do WhatsApp oficial ligada(s) ao card ${card.id}.`);

    for (let tentativa = 0; ; tentativa++) {
      const r = await this.chatwoot.passarParaHumano(card.phone);
      if (r.ok) {
        const nome = await this.leads.nomeUsuario(evento.ownerId);
        await this.leads.registrarAvisoConversaVivi(
          evento.tenantId,
          card.id,
          `Conversa do WhatsApp oficial passada da VIVI para ${nome}`,
          false,
        );
        this.logger.log(`Card ${card.id}: conversa #${r.conversaId} passada da VIVI para humano (${evento.via}).`);
        return 'passada';
      }
      // Cliente sem conversa aberta com a VIVI (ex.: lead manual) ou Chatwoot
      // nao configurado: nada a passar, nao e erro.
      if (r.motivo === 'sem_conversa_ativa') return 'sem_conversa';
      if (r.motivo === 'nao_configurado') return 'nao_configurado';
      if (tentativa >= ESPERAS_NOVA_TENTATIVA_MS.length) break;
      this.logger.warn(`Card ${card.id}: falha ao passar a conversa (${r.detalhe ?? r.motivo}) - nova tentativa.`);
      await this.esperar(ESPERAS_NOVA_TENTATIVA_MS[tentativa]);
    }

    this.logger.error(`Card ${card.id}: conversa NAO passada da VIVI apos 3 tentativas.`);
    await this.leads.registrarAvisoConversaVivi(
      evento.tenantId,
      card.id,
      'Atenção: não foi possível tirar a conversa da VIVI. Envie uma mensagem pelo Gestor para assumir o cliente.',
      true,
    );
    return 'falhou';
  }
}
