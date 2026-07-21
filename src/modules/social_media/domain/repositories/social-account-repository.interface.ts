// src/modules/social_media/domain/repositories/social-account-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface SocialAccountRecord {
  id: string;
  tenantId: string;
  canal: string;
  accountName: string;
  externalId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSocialAccountInput {
  tenantId: string;
  canal: string;
  accountName: string;
  externalId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  status: string;
}

export interface UpdateSocialAccountInput {
  accountName?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  status?: string;
}

export interface ISocialAccountRepository {
  create(input: CreateSocialAccountInput): Promise<SocialAccountRecord>;
  findAllByTenant(tenantId: string): Promise<SocialAccountRecord[]>;
  findById(id: string): Promise<SocialAccountRecord | null>;
  // Usado para reconexao idempotente (OAuth executado de novo para a mesma
  // pagina/conta ja conectada antes) - atualiza em vez de duplicar.
  findByTenantCanalAndExternalId(
    tenantId: string,
    canal: string,
    externalId: string,
  ): Promise<SocialAccountRecord | null>;
  update(id: string, input: UpdateSocialAccountInput): Promise<SocialAccountRecord>;
}
