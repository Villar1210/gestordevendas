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
  // So relevante quando o Role for Cliente: comprador, proprietario ou
  // ambos - ver Portal do Cliente (GetMeUseCase devolve para o frontend
  // decidir quais secoes mostrar em /minha-conta).
  tipoCliente: string | null;
  role: { name: string };
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserWithRole | null>;
  findById(id: string): Promise<UserWithRole | null>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  updateName(userId: string, name: string): Promise<void>;
  setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void>;
  // Usado pelo modulo notificacoes (CadastroPendenteCriadoListener) para
  // encontrar todos os Administradores de um tenant e notificar cada um.
  findAllByTenantAndRole(tenantId: string, roleName: string): Promise<{ id: string }[]>;
}

export interface ITenantOnboardingRepository {
  registerCompanyWithOwner(input: {
    companyName: string;
    ownerName: string;
    email: string;
    hashedPassword: string;
  }): Promise<{ tenantId: string; userId: string }>;
}
