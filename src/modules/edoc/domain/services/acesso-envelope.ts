// src/modules/edoc/domain/services/acesso-envelope.ts
// Camada de DOMINIO (funcao pura). Fase A do mapa de processos (27/10/2026):
// antes, qualquer corretor listava e abria TODOS os envelopes da empresa
// (contratos de outros corretores, documentos de clientes). Agora o
// Administrador ve todos; os demais veem so os envelopes que eles mesmos
// criaram. Quem so precisa ASSINAR continua usando o link do e-mail
// (/assinar/:token), que nao passa por aqui.
const ADMINISTRADOR_ROLE_NAME = 'Administrador';

// null = sem filtro (todos do tenant); string = so os criados por esse usuario.
export function filtroCriadorEnvelope(requesterRole: string, requesterUserId: string): string | null {
  return requesterRole === ADMINISTRADOR_ROLE_NAME ? null : requesterUserId;
}

export function podeVerEnvelope(
  requesterRole: string,
  requesterUserId: string,
  createdByUserId: string,
): boolean {
  const filtro = filtroCriadorEnvelope(requesterRole, requesterUserId);
  return filtro === null || filtro === createdByUserId;
}
