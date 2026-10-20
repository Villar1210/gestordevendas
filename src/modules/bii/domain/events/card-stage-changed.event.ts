// src/modules/bii/domain/events/card-stage-changed.event.ts
// COPIA do contrato emitido pelo vendas_kanban
// (vendas_kanban/domain/events/card-stage-changed.event.ts) - modulos nao
// importam arquivos uns dos outros (CLAUDE.md, "Organizacao de pastas por
// modulo"); o contrato entre os dois e so o nome do evento + este formato.
// Ver docs/bii/fatia1/CONTRATO_PAINEL.md.
export const CARD_STAGE_CHANGED_EVENT = 'card.stage.changed';

export type CardStageChangedOrigem = 'move' | 'claim' | 'job_repique' | 'promocao' | 'criacao';

export interface CardStageChangedEvent {
  tenantId: string;
  cardId: string;
  pipelineId: string | null;
  fromStageId: string | null;
  toStageId: string;
  userId: string | null;
  origem: CardStageChangedOrigem;
  ocorridoEm: Date;
  motivoRepique?: string | null;
}
