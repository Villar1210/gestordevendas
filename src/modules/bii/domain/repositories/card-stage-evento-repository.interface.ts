// src/modules/bii/domain/repositories/card-stage-evento-repository.interface.ts
// Escrita do historico de etapas (listener do evento card.stage.changed).

export interface NovoCardStageEvento {
  tenantId: string;
  cardId: string;
  pipelineId: string | null;
  fromStageId: string | null;
  toStageId: string;
  fromStageNome: string | null;
  toStageNome: string;
  userId: string | null;
  origem: string;
  motivoRepique: string | null;
  ocorridoEm: Date;
}

export interface ICardStageEventoRepository {
  // Nome atual das etapas (por id + tenantId). Etapa de outro tenant ou
  // inexistente simplesmente nao aparece no mapa.
  buscarNomesEtapas(tenantId: string, stageIds: string[]): Promise<Map<string, string>>;
  // true se o card existe NESTE tenant (defesa: nunca gravar evento cruzado).
  cardPertenceAoTenant(tenantId: string, cardId: string): Promise<boolean>;
  registrar(evento: NovoCardStageEvento): Promise<void>;
}
