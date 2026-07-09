// src/modules/gestao_imobiliaria/domain/repositories/contrato-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ContratoRecord {
  id: string;
  tenantId: string;
  imovelId: string;
  proprietarioId: string;
  inquilinoCompradorId: string;
  tipo: string;
  valor: number;
  dataInicio: Date;
  dataFim: Date | null;
  diaVencimento: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContratoFilters {
  tipo?: string;
  status?: string;
  imovelId?: string;
  proprietarioId?: string;
}

export interface IContratoRepository {
  create(input: {
    tenantId: string;
    imovelId: string;
    proprietarioId: string;
    inquilinoCompradorId: string;
    tipo: string;
    valor: number;
    dataInicio: Date;
    dataFim?: Date | null;
    diaVencimento?: number | null;
  }): Promise<ContratoRecord>;
  updateStatus(id: string, status: string): Promise<ContratoRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ContratoRecord | null>;
  findAllByTenant(tenantId: string, filters?: ContratoFilters): Promise<ContratoRecord[]>;
}
