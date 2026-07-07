// src/modules/auth/domain/repositories/two-factor-code-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface TwoFactorCodeRecord {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
  used: boolean;
}

export interface ITwoFactorCodeRepository {
  create(input: { userId: string; code: string; expiresAt: Date }): Promise<string>;
  invalidateAllForUser(userId: string): Promise<void>;
  findById(id: string): Promise<TwoFactorCodeRecord | null>;
  markAsUsed(id: string): Promise<void>;
}
