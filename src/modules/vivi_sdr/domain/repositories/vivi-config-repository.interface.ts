// src/modules/vivi_sdr/domain/repositories/vivi-config-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface ViviConfigRecord {
  id: string;
  tenantId: string;
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteFaixa1: number;
  limiteFaixa2: number;
  limiteFaixa3: number;
  limiteFaixa4: number;
  faixa1SubsidioMax: number | null;
  faixa1JurosMin: number | null;
  faixa1JurosMax: number | null;
  faixa1TetoFinanciamento: string | null;
  faixa1ExemploParcela: string | null;
  faixa2SubsidioMax: number | null;
  faixa2JurosMin: number | null;
  faixa2JurosMax: number | null;
  faixa2TetoFinanciamento: string | null;
  faixa2ExemploParcela: string | null;
  faixa3SubsidioMax: number | null;
  faixa3JurosMin: number | null;
  faixa3JurosMax: number | null;
  faixa3TetoFinanciamento: string | null;
  faixa3ExemploParcela: string | null;
  faixa4SubsidioMax: number | null;
  faixa4JurosMin: number | null;
  faixa4JurosMax: number | null;
  faixa4TetoFinanciamento: string | null;
  faixa4ExemploParcela: string | null;
  updatedAt: Date;
}

export interface UpdateViviConfigInput {
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteFaixa1: number;
  limiteFaixa2: number;
  limiteFaixa3: number;
  limiteFaixa4: number;
  faixa1SubsidioMax: number | null;
  faixa1JurosMin: number | null;
  faixa1JurosMax: number | null;
  faixa1TetoFinanciamento: string | null;
  faixa1ExemploParcela: string | null;
  faixa2SubsidioMax: number | null;
  faixa2JurosMin: number | null;
  faixa2JurosMax: number | null;
  faixa2TetoFinanciamento: string | null;
  faixa2ExemploParcela: string | null;
  faixa3SubsidioMax: number | null;
  faixa3JurosMin: number | null;
  faixa3JurosMax: number | null;
  faixa3TetoFinanciamento: string | null;
  faixa3ExemploParcela: string | null;
  faixa4SubsidioMax: number | null;
  faixa4JurosMin: number | null;
  faixa4JurosMax: number | null;
  faixa4TetoFinanciamento: string | null;
  faixa4ExemploParcela: string | null;
}

export interface IViviConfigRepository {
  findByTenantId(tenantId: string): Promise<ViviConfigRecord | null>;
  create(tenantId: string): Promise<ViviConfigRecord>;
  update(tenantId: string, input: UpdateViviConfigInput): Promise<ViviConfigRecord>;
}
