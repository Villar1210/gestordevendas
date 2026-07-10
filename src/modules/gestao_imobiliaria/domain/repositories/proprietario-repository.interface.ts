// src/modules/gestao_imobiliaria/domain/repositories/proprietario-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ProprietarioRecord {
  id: string;
  tenantId: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  createdAt: Date;
  // Preenchido apenas por findAllByTenant: quantidade de imoveis distintos
  // vinculados a este proprietario atraves de Contrato.
  imoveisVinculados?: number;
}

// Campos graváveis, compartilhados entre create (nome/telefone
// obrigatorios) e update (tudo opcional).
export interface ProprietarioWritableFields {
  nome?: string;
  cpfCnpj?: string | null;
  telefone?: string;
  email?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  pix?: string | null;
}

export interface IProprietarioRepository {
  create(
    input: ProprietarioWritableFields & { tenantId: string; nome: string; telefone: string },
  ): Promise<ProprietarioRecord>;
  update(id: string, input: ProprietarioWritableFields): Promise<ProprietarioRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ProprietarioRecord | null>;
  // Inclui imoveisVinculados (contagem via Contrato) em cada registro.
  findAllByTenant(tenantId: string): Promise<ProprietarioRecord[]>;
  // Usado pelo Portal do Cliente para vincular o usuario logado (por
  // e-mail) ao seu cadastro de Proprietario - ver CLAUDE.md sobre a
  // limitacao dessa correspondencia (por valor, nao por FK formal). Se
  // houver mais de um Proprietario com o mesmo e-mail no tenant (nao ha
  // constraint de unicidade), retorna o primeiro encontrado.
  findByTenantAndEmail(tenantId: string, email: string): Promise<ProprietarioRecord | null>;
}
