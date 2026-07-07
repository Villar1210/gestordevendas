// src/modules/vendas_kanban/domain/repositories/pipeline-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface PipelineRecord {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

export interface IPipelineRepository {
  create(input: { tenantId: string; name: string }): Promise<PipelineRecord>;
  findById(id: string): Promise<PipelineRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<PipelineRecord | null>;
  findAllByTenant(tenantId: string): Promise<PipelineRecord[]>;
}
