// src/modules/auth/domain/services/password-reset-token.ts
// O link de redefinicao leva o token original; o banco guarda so o hash.
// Funcoes puras (node:crypto e da propria plataforma, nao biblioteca externa).
import { createHash, randomBytes } from 'node:crypto';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export function gerarTokenRedefinicao(): string {
  return randomBytes(32).toString('hex');
}

export function hashTokenRedefinicao(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
