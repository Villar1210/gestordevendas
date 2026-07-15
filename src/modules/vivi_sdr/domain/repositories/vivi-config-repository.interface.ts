// src/modules/vivi_sdr/domain/repositories/vivi-config-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface ViviConfigRecord {
  id: string;
  tenantId: string;
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteHis1: number;
  limiteHis2: number;
  limiteHmp: number;
  updatedAt: Date;
}

export interface IViviConfigRepository {
  findByTenantId(tenantId: string): Promise<ViviConfigRecord | null>;
  create(tenantId: string): Promise<ViviConfigRecord>;
  update(
    tenantId: string,
    input: {
      precoMinimo: number;
      limiteSemPerfil: number;
      limiteHis1: number;
      limiteHis2: number;
      limiteHmp: number;
    },
  ): Promise<ViviConfigRecord>;
}
