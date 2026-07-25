// src/modules/vendas_kanban/domain/repositories/activity-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ActivityRecord {
  id: string;
  tenantId: string;
  cardId: string;
  type: string;
  subject: string | null;
  scheduledAt: Date | null;
  done: boolean;
  createdAt: Date;
  // So preenchidos pela consulta do Dashboard do Corretor
  // (findPendingTodayByOwner), que faz o join com o titulo/pipeline do card
  // - cardPipelineId permite o frontend montar o link de volta pro Kanban
  // (/dashboard/kanban?pipelineId=...&cardId=...).
  cardTitle?: string;
  cardPipelineId?: string;
}

export interface IActivityRepository {
  create(input: {
    tenantId: string;
    cardId: string;
    type: string;
    subject?: string | null;
    scheduledAt?: Date | null;
  }): Promise<ActivityRecord>;
  findById(id: string): Promise<ActivityRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ActivityRecord | null>;
  // Retorna ordenado por scheduledAt (crescente, nulos por ultimo).
  findAllByCard(cardId: string): Promise<ActivityRecord[]>;
  setDone(id: string, done: boolean): Promise<ActivityRecord>;
  // Usado por AgendarVisitaUseCase para idempotencia (upsert): se a VIVI
  // chamar "agendar_visita" de novo para o mesmo card com uma Activity tipo
  // "visita" ja pendente (done=false), atualiza essa Activity em vez de
  // criar outra identica - reconfirmar o mesmo horario vira um no-op
  // pratico, mudar de horario atualiza de fato. Se houver mais de uma
  // pendente (dado historico de antes desta correcao), pega a mais recente.
  findPendingByCardAndType(
    tenantId: string,
    cardId: string,
    type: string,
  ): Promise<ActivityRecord | null>;
  update(id: string, input: { subject: string | null; scheduledAt: Date | null }): Promise<ActivityRecord>;
  // Usado pelo Dashboard do Corretor: atividades agendadas para HOJE (fuso
  // local do processo, mesma logica ja usada em date-only.util.ts) ainda
  // nao concluidas, dos cards de um dono especifico. Ordenado por
  // scheduledAt crescente.
  findPendingTodayByOwner(tenantId: string, ownerId: string): Promise<ActivityRecord[]>;
  // Usado pelo Board/Caixa de Entrada (GetBoardUseCase/GetInboxUseCase) para
  // o indicador visual de "proxima atividade agendada" no KanbanCard/
  // InboxView, numa unica consulta em lote (evita N+1 - uma query por
  // card). Para cada card, retorna a atividade NAO CONCLUIDA com o
  // scheduledAt mais proximo - a mais atrasada, se houver alguma vencida
  // (scheduledAt no passado ordena antes de scheduledAt no futuro), senao
  // a mais proxima no futuro. Cards sem nenhuma atividade pendente
  // agendada simplesmente nao aparecem no array de retorno.
  findProximasByCardIds(cardIds: string[]): Promise<
    Array<{ cardId: string; type: string; subject: string | null; scheduledAt: Date }>
  >;
}
