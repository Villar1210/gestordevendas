// src/modules/auth/domain/repositories/user-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface UserWithRole {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  password: string;
  twoFactorEnabled: boolean;
  statusCadastro: string;
  tipoCliente: string | null;
  cargoHierarquico: string | null;
  standId: string | null;
  mustChangePassword: boolean;
  // Controle de revogacao de sessao: incrementado no logout e na troca de
  // senha. Tokens JWT carregam este valor como claim "tv" e sao rejeitados
  // se o valor no banco divergir (sessao revogada).
  tokenVersion: number;
  role: { name: string };
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserWithRole | null>;
  findById(id: string): Promise<UserWithRole | null>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  updateName(userId: string, name: string): Promise<void>;
  setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void>;
  // Revoga todas as sessoes ativas do usuario incrementando o tokenVersion.
  // Chamado no logout e automaticamente na troca de senha.
  incrementTokenVersion(userId: string): Promise<void>;
  findAllByTenantAndRole(tenantId: string, roleName: string): Promise<{ id: string }[]>;
  findAllByTenantAndSuperiorIds(tenantId: string, superiorIds: string[]): Promise<{ id: string }[]>;
}

export interface ITenantOnboardingRepository {
  registerCompanyWithOwner(input: {
    companyName: string;
    ownerName: string;
    email: string;
    hashedPassword: string;
  }): Promise<{ tenantId: string; userId: string }>;
}
