// src/modules/campanhas_sms/domain/services/optout.ts
// Reconhece pedido de descadastro numa resposta de SMS (dominio puro).
// Vale a palavra sozinha ou no comeco da mensagem ("Sair", "PARE por favor",
// "nao quero mais"). Comparacao sem acento, sem caixa e sem pontuacao.
// Respostas como "quero sair do aluguel" NAO contam (palavra no meio).

const PALAVRAS_SAIDA = ['SAIR', 'PARAR', 'PARE', 'STOP', 'CANCELAR', 'DESCADASTRAR', 'REMOVER', 'NAO QUERO', 'NAO ENVIE', 'NAO MANDE'];

export function normalizarResposta(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ehPedidoDeSaida(texto: string): boolean {
  const t = normalizarResposta(texto);
  if (!t) return false;
  return PALAVRAS_SAIDA.some((p) => t === p || t.startsWith(`${p} `));
}

/** Texto da resposta para guardar: sem caracteres de controle, ate 500. */
export function limparResposta(texto: string): string {
  return String(texto ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, 500);
}
