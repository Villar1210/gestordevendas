// src/modules/auth/domain/repositories/password-reset-token-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

// Atencao: o campo "token" guarda o HASH SHA-256 do link enviado por
// e-mail, nunca o valor original (quem ler o banco nao consegue usar).
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
  findByToken(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  // Marca como usado SO se ainda nao foi usado. Retorna false se outra
  // requisicao chegou antes (duplo clique / uso simultaneo do mesmo link).
  consumir(id: string): Promise<boolean>;
}
