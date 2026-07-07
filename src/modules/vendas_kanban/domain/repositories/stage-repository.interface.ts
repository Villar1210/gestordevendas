// src/modules/vendas_kanban/domain/repositories/stage-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface StageRecord {
  id: string;
  tenantId: string;
  pipelineId: string;
  name: string;
  position: number;
}

export interface IStageRepository {
  create(input: {
    tenantId: string;
    pipelineId: string;
    name: string;
    position: number;
  }): Promise<StageRecord>;
  findById(id: string): Promise<StageRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<StageRecord | null>;
  // Retorna ordenado por position (crescente).
  findAllByPipeline(pipelineId: string): Promise<StageRecord[]>;
  updatePosition(id: string, position: number): Promise<void>;
}
