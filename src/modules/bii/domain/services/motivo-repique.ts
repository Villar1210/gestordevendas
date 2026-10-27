// src/modules/bii/domain/services/motivo-repique.ts
// Rotulos dos motivos de Repique (perda). Origem: valores de
// vendas_kanban/domain/services/motivo-repique.ts (MOTIVOS_REPIQUE) com os
// mesmos rotulos do modal do Kanban (frontend/src/features/kanban/constants.ts,
// MOTIVO_REPIQUE_OPTIONS). Copiado aqui porque modulo nao importa modulo -
// se um motivo novo surgir la, acrescentar aqui (sem rotulo, o valor cru
// aparece no painel, nada quebra).
export const MOTIVO_NAO_INFORMADO = 'NAO_INFORMADO';

export const ROTULOS_MOTIVO_REPIQUE: Record<string, string> = {
  SEM_RESPOSTA_90_DIAS: 'Sem resposta há 90+ dias',
  SEM_RESPOSTA_VIVI: 'Sem resposta no atendimento da VIVI (7 dias)',
  RESTRICAO_CPF: 'Restrição no CPF',
  PRECO: 'Preço (fora do orçamento do lead)',
  SEM_PERFIL: 'Sem perfil para financiamento',
  OUTRO: 'Outro motivo',
  [MOTIVO_NAO_INFORMADO]: 'Não informado',
};

export function chaveMotivo(motivo: string | null | undefined): string {
  const m = (motivo ?? '').trim();
  return m === '' ? MOTIVO_NAO_INFORMADO : m;
}

export function rotuloMotivo(motivo: string | null | undefined): string {
  const chave = chaveMotivo(motivo);
  return ROTULOS_MOTIVO_REPIQUE[chave] ?? chave;
}
