// src/modules/vendas_kanban/domain/events/lead-assumido.event.ts
// WhatsApp integrado - Etapa 2 (19/11/2026): o lead passou a ter um dono
// HUMANO DEFINITIVO (nao uma atribuicao automatica ainda aguardando aceite).
// Emitido DEPOIS da escrita, com emit (nao aguarda quem escuta):
// - 'aceite'              corretor clicou "Aceitar lead" (Roleta automatica);
// - 'sugestao'            sugestao da Roleta confirmada (semi automatica);
// - 'iniciar_atendimento' usuario assumiu o card na Caixa de Entrada;
// - 'escalado_gestao'     ninguem aceitou e o lead subiu para a gestao.
// Consumidor hoje: vivi-integration (passa a conversa da VIVI para humano no
// Chatwoot, para a VIVI parar de responder).
export const LEAD_ASSUMIDO_EVENT = 'lead.assumido';

export type LeadAssumidoVia = 'aceite' | 'sugestao' | 'iniciar_atendimento' | 'escalado_gestao';

export interface LeadAssumidoEvent {
  tenantId: string;
  cardId: string;
  ownerId: string;
  via: LeadAssumidoVia;
}
