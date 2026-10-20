// src/modules/bii/domain/repositories/painel-vendas-repository.interface.ts
// Leituras do Painel de Vendas. TODA consulta recebe tenantId e filtra por
// ele (isolamento multitenant - coberto por teste de integracao). O BII le
// Card/Stage/Pipeline/User por este repositorio proprio, sem importar nada do
// vendas_kanban.

export interface FiltroPainel {
  tenantId: string;
  pipelineId: string;
  inicio: Date; // inclusivo (meia-noite local do "de")
  fimExclusivo: Date; // meia-noite local do dia seguinte ao "ate"
  corretorId?: string | null; // Card.ownerId
  origem?: string | null; // Card.origem
}

export interface CardCriadoRow {
  cardId: string;
  ownerId: string | null;
  origem: string;
  createdAt: Date;
}

export interface CardResumoRow {
  ownerId: string | null;
  origem: string;
  value: number; // Decimal convertido para number
  createdAt: Date;
}

export interface EventoEntradaRow {
  cardId: string;
  toStageId: string;
  toStageNome: string;
  motivoRepique: string | null;
  ocorridoEm: Date;
  card: CardResumoRow;
}

export interface IdNome {
  id: string;
  nome: string;
}

export interface IPainelVendasRepository {
  // Pipelines do tenant, do mais antigo para o mais novo.
  listarPipelines(tenantId: string): Promise<IdNome[]>;
  // Etapas do pipeline (do tenant), em ordem de position.
  listarEtapas(tenantId: string, pipelineId: string): Promise<IdNome[]>;
  // Usuarios do tenant donos de ao menos um card do pipeline (so id + nome).
  listarCorretores(tenantId: string, pipelineId: string): Promise<IdNome[]>;
  // Valores distintos de Card.origem no pipeline.
  listarOrigens(tenantId: string, pipelineId: string): Promise<string[]>;
  // Data do primeiro BiiCardStageEvento do tenant (null = sem historico).
  buscarInicioHistorico(tenantId: string): Promise<Date | null>;
  // Cards criados no periodo (leads novos), com os filtros aplicados.
  listarCardsCriados(filtro: FiltroPainel): Promise<CardCriadoRow[]>;
  // Eventos de entrada em etapa no periodo (pipeline do evento = filtro), com
  // os dados do card necessarios para os calculos.
  listarEventosEntrada(filtro: FiltroPainel): Promise<EventoEntradaRow[]>;
}
