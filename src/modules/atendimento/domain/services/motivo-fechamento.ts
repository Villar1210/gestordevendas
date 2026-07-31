// src/modules/atendimento/domain/services/motivo-fechamento.ts
// Camada de DOMINIO: valores validos de Atendimento.motivoFechamento, mesmo
// padrao ja usado por vendas_kanban/domain/services/motivo-repique.ts
// (MOTIVOS_REPIQUE). Lista fechada de motivos de NEGOCIO (decisao humana ao
// fechar) - "abandono" (deteccao automatica por timeout de inatividade)
// fica DE FORA de proposito nesta etapa: e o escopo do I8b (mecanismo ainda
// nao existe, pendente de decisao futura sobre se vale a pena construir).
export const MOTIVOS_FECHAMENTO = [
  'venda_concluida',
  'desistencia',
  'finalizacao_normal',
] as const;

export type MotivoFechamento = (typeof MOTIVOS_FECHAMENTO)[number];

export function isMotivoFechamentoValido(valor: string): valor is MotivoFechamento {
  return (MOTIVOS_FECHAMENTO as readonly string[]).includes(valor);
}
