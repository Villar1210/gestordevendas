// src/modules/configuracoes/domain/repositories/tenant-config-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// Dono canonico da leitura/escrita dos dados de empresa do Tenant
// (razao social = "name", CNPJ, endereco completo) - outros modulos que
// precisem so LER esses dados (ex: rh, para o contrato de prestacao de
// servico) importam esta interface via ConfiguracoesModule, em vez de
// manter uma copia propria (mesmo padrao ja usado por ICardRepository/
// IStageRepository, centralizados em vendas_kanban e reaproveitados por
// varios outros modulos).
// AcaoLimiteVivi: string literal (nao o enum gerado do Prisma) de proposito
// - domain/ nao pode importar nada gerado pelo Prisma (ver CLAUDE.md).
export type AcaoLimiteVivi = 'ALERTAR' | 'PAUSAR';

export interface TenantConfigRecord {
  id: string;
  name: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  // Controle de volume/custo da VIVI (Fatia B, modulo vivi_sdr) - lido por
  // RegistrarUsoViviUseCase, escrito so por aqui (mesmo padrao ja usado
  // para CNPJ/endereco).
  limiteMensagensViviDia: number;
  acaoLimiteVivi: AcaoLimiteVivi;
}

export interface UpdateTenantConfigInput {
  name?: string;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  limiteMensagensViviDia?: number;
  acaoLimiteVivi?: AcaoLimiteVivi;
}

export interface ITenantConfigRepository {
  findByTenantId(tenantId: string): Promise<TenantConfigRecord | null>;
  update(tenantId: string, input: UpdateTenantConfigInput): Promise<TenantConfigRecord>;
}
