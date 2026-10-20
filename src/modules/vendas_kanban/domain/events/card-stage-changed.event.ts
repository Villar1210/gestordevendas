// src/modules/vendas_kanban/domain/events/card-stage-changed.event.ts
// Contrato do evento emitido sempre que Card.stageId muda de verdade (ou
// quando um card ja nasce com stage). O vendas_kanban so EMITE (com emit, nao
// emitAsync, DEPOIS da escrita bem-sucedida) - nao conhece quem escuta. Hoje o
// unico consumidor e o modulo BII (historico de etapas / Painel de Vendas),
// que tem a propria copia desta interface (modulos nao importam arquivos uns
// dos outros). Ver docs/bii/fatia1/CONTRATO_PAINEL.md e CLAUDE.md.
export const CARD_STAGE_CHANGED_EVENT = 'card.stage.changed';

export type CardStageChangedOrigem = 'move' | 'claim' | 'job_repique' | 'promocao' | 'criacao';

export interface CardStageChangedEvent {
  tenantId: string;
  cardId: string;
  pipelineId: string | null;
  fromStageId: string | null; // null = entrada no funil (Caixa de Entrada/criacao)
  toStageId: string;
  userId: string | null; // null = job/sistema
  origem: CardStageChangedOrigem;
  ocorridoEm: Date;
  motivoRepique?: string | null;
}
