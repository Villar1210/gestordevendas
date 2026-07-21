// src/modules/social_media/domain/services/social-oauth-state.ts
// Camada de DOMINIO: funcao/constante pura, sem Prisma/NestJS. O "purpose"
// e gravado dentro do JWT assinado usado como "state" do fluxo OAuth
// (ver IniciarConexaoSocialUseCase) e conferido de novo no callback
// (ver ProcessarCallbackOAuthUseCase) - garante que um JWT de login comum
// nunca possa ser reaproveitado como state por engano (ou vice-versa).
export const SOCIAL_OAUTH_STATE_PURPOSE = 'social_oauth_state';

export interface SocialOAuthStatePayload {
  tenantId: string;
  userId: string;
  purpose: typeof SOCIAL_OAUTH_STATE_PURPOSE;
}

export function isSocialOAuthStatePayload(
  payload: unknown,
): payload is SocialOAuthStatePayload {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.tenantId === 'string' &&
    typeof candidate.userId === 'string' &&
    candidate.purpose === SOCIAL_OAUTH_STATE_PURPOSE
  );
}
