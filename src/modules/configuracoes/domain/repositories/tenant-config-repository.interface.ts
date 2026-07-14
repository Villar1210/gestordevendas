// src/modules/configuracoes/domain/repositories/tenant-config-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// Dono canonico da leitura/escrita dos dados de empresa do Tenant
// (razao social = "name", CNPJ, endereco completo) - outros modulos que
// precisem so LER esses dados (ex: rh, para o contrato de prestacao de
// servico) importam esta interface via ConfiguracoesModule, em vez de
// manter uma copia propria (mesmo padrao ja usado por ICardRepository/
// IStageRepository, centralizados em vendas_kanban e reaproveitados por
// varios outros modulos).
export interface TenantConfigRecord {
  id: string;
  name: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
}

export interface UpdateTenantConfigInput {
  name?: string;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
}

export interface ITenantConfigRepository {
  findByTenantId(tenantId: string): Promise<TenantConfigRecord | null>;
  update(tenantId: string, input: UpdateTenantConfigInput): Promise<TenantConfigRecord>;
}
