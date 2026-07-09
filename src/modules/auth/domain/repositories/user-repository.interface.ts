// src/modules/auth/domain/repositories/user-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface UserWithRole {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  password: string;
  twoFactorEnabled: boolean;
  // Modulo RH completo: pendente_aprovacao, aprovado ou rejeitado - ver
  // AuthenticateUserUseCase.
  statusCadastro: string;
  role: { name: string };
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserWithRole | null>;
  findById(id: string): Promise<UserWithRole | null>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void>;
}

export interface ITenantOnboardingRepository {
  registerCompanyWithOwner(input: {
    companyName: string;
    ownerName: string;
    email: string;
    hashedPassword: string;
  }): Promise<{ tenantId: string; userId: string }>;
}
