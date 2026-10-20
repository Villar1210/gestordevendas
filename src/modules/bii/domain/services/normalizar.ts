// src/modules/bii/domain/services/normalizar.ts
// Comparacao de nomes de etapa sem acento e sem caixa ("Fechamento",
// "FECHAMENTO", " fechamento " sao a mesma etapa). Funcao PURA.

export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Nomes fixos das etapas protegidas do Kanban (mesmos de
// vendas_kanban/domain/services/protected-stages.ts, copiados aqui - modulo
// nao importa modulo). Ganho = ENTRAR em "Fechamento"; perda = ENTRAR em
// "Repique" (decisao 1 do Villar, docs/bii/fatia1/CONTRATO_PAINEL.md).
export const ETAPA_GANHO_NORMALIZADA = 'fechamento';
export const ETAPA_PERDA_NORMALIZADA = 'repique';

export function ehEtapaGanho(nome: string | null | undefined): boolean {
  return normalizarTexto(nome) === ETAPA_GANHO_NORMALIZADA;
}

export function ehEtapaPerda(nome: string | null | undefined): boolean {
  return normalizarTexto(nome) === ETAPA_PERDA_NORMALIZADA;
}
