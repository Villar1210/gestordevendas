// src/modules/rh/domain/repositories/cadastro-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// Cobre o fluxo generico de cadastro publico multi-perfil (Cliente,
// Corretor House/Parceiro, Imobiliaria Parceira) - distinto de
// ICorretorRepository, que e especifico do cadastro de Corretor pelo
// Administrador (fatia minima do RH).

export interface CadastroRecord {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  nomeImobiliaria: string | null;
  cnpj: string | null;
  creciJ: string | null;
  cargoNaEmpresa: string | null;
  cargoHierarquico: string | null;
  superiorId: string | null;
  tipoCliente: string | null;
  cep: string | null;
  endereco: string | null;
  statusCadastro: string;
  roleId: string;
  roleName: string;
  createdAt: Date;
}

export interface CreateCadastroInput {
  tenantId: string;
  roleId: string;
  name: string;
  email: string;
  hashedPassword: string;
  telefone?: string;
  cpf?: string;
  creci?: string;
  nomeImobiliaria?: string;
  cnpj?: string;
  creciJ?: string;
  cargoNaEmpresa?: string;
  tipoCliente?: string;
  cep?: string;
  endereco?: string;
}

export interface SuperiorCandidateRecord {
  id: string;
  name: string;
  cargoHierarquico: string | null;
}

export interface ICadastroRepository {
  findByEmail(email: string): Promise<{ id: string } | null>;
  // Sempre cria com statusCadastro = "pendente_aprovacao" - e o unico
  // ponto de entrada do cadastro publico.
  create(input: CreateCadastroInput): Promise<CadastroRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<CadastroRecord | null>;
  findAllPendentesByTenant(tenantId: string): Promise<CadastroRecord[]>;
  aprovar(input: {
    id: string;
    cargoHierarquico?: string;
    superiorId?: string;
  }): Promise<CadastroRecord>;
  rejeitar(id: string): Promise<CadastroRecord>;
  // Usuarios do tenant com cargoHierarquico preenchido - candidatos a
  // "superior" no seletor de hierarquia (tela de aprovacao).
  findPossiveisSuperioresByTenant(tenantId: string): Promise<SuperiorCandidateRecord[]>;
}
