// src/modules/roleta_online/domain/repositories/roleta-config-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface RoletaConfigRecord {
  id: string;
  tenantId: string;
  algoritmo: string;
  modo: string;
  ativa: boolean;
  ultimoCorretorId: string | null;
  // So se aplica ao modo "automatico" - ver ProcessRoletaTimeoutsUseCase.
  timeoutAceiteMinutos: number;
  updatedAt: Date;
}

export interface IRoletaConfigRepository {
  findByTenant(tenantId: string): Promise<RoletaConfigRecord | null>;
  // Cria a config do tenant se ainda nao existir (aplicando os defaults do
  // schema), ou atualiza so os campos informados (undefined = mantem o
  // valor atual).
  upsert(input: {
    tenantId: string;
    algoritmo?: string;
    modo?: string;
    ativa?: boolean;
    timeoutAceiteMinutos?: number;
  }): Promise<RoletaConfigRecord>;
  updateUltimoCorretor(tenantId: string, corretorId: string): Promise<void>;
}
