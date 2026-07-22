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
  // Usado pelo webhook da Meta (ProcessMetaWebhookEventUseCase) para
  // resolver o tenant a partir do Page ID/IG Business ID recebido no
  // payload - SEM tenantId, ja que o webhook nao manda essa informacao
  // (diferente de findByTenantCanalAndExternalId acima, usado no fluxo de
  // OAuth onde o tenant ja e conhecido pelo JWT do usuario logado).
  findByCanalAndExternalId(canal: string, externalId: string): Promise<SocialAccountRecord | null>;
  update(id: string, input: UpdateSocialAccountInput): Promise<SocialAccountRecord>;
}
