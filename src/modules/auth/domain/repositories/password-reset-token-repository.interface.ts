// src/modules/auth/domain/repositories/password-reset-token-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

export interface IPasswordResetTokenRepository {
  create(input: { userId: string; token: string; expiresAt: Date }): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
  findByToken(token: string): Promise<PasswordResetTokenRecord | null>;
  markAsUsed(id: string): Promise<void>;
}
