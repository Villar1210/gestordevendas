// src/modules/campanhas_sms/domain/services/campanha-regras.ts
// Estados, limites e validacoes da campanha (dominio puro).

export const STATUS_CAMPANHA = ['rascunho', 'enviando', 'pausada', 'concluida', 'cancelada'] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];

export const STATUS_CONTATO = [
  'pendente',
  'enviando',
  'enviado',
  'entregue',
  'falhou',
  'bloqueado',
  'optout',
  'cancelado',
] as const;
export type StatusContato = (typeof STATUS_CONTATO)[number];

export const LIMITES = {
  contatosPorCampanha: 5_000,
  arquivoBytes: 5 * 1024 * 1024,
  linhasArquivo: 10_000,
  tentativasEnvio: 3,
  taxaMin: 6,
  taxaMax: 120,
  segmentosMax: 3,
  campanhasPorTenant: 500,
  optoutDiasResposta: 60,
} as const;

export const PADROES = {
  maxSegmentos: 1,
  taxaPorMinuto: 30,
  janelaInicio: 9,
  janelaFim: 20,
} as const;

/** Onde mensagem/link/configuracao/contatos ainda podem mudar. */
export const STATUS_EDITAVEIS: StatusCampanha[] = ['rascunho', 'pausada'];

export function podeEditar(status: string): boolean {
  return (STATUS_EDITAVEIS as string[]).includes(status);
}

export function podeIniciar(status: string): boolean {
  return status === 'rascunho' || status === 'pausada';
}

export function podePausar(status: string): boolean {
  return status === 'enviando';
}

export function podeCancelar(status: string): boolean {
  return status === 'rascunho' || status === 'enviando' || status === 'pausada';
}

export interface ConfigCampanha {
  maxSegmentos: number;
  taxaPorMinuto: number;
  janelaInicio: number;
  janelaFim: number;
}

/** Devolve a mensagem de erro (para 400) ou null. */
export function validarConfig(c: ConfigCampanha): string | null {
  if (!Number.isInteger(c.maxSegmentos) || c.maxSegmentos < 1 || c.maxSegmentos > LIMITES.segmentosMax) {
    return `Máximo de partes do SMS deve ficar entre 1 e ${LIMITES.segmentosMax}.`;
  }
  if (!Number.isInteger(c.taxaPorMinuto) || c.taxaPorMinuto < LIMITES.taxaMin || c.taxaPorMinuto > LIMITES.taxaMax) {
    return `Ritmo de envio deve ficar entre ${LIMITES.taxaMin} e ${LIMITES.taxaMax} SMS por minuto.`;
  }
  if (!Number.isInteger(c.janelaInicio) || !Number.isInteger(c.janelaFim) || c.janelaInicio < 6 || c.janelaFim > 22 || c.janelaInicio >= c.janelaFim) {
    return 'Horário de envio inválido: o início deve ser antes do fim, entre 6h e 22h.';
  }
  return null;
}

/** Link de destino: so https, host com ponto, sem usuario/senha embutidos. */
export function validarLinkDestino(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return 'Link de destino inválido. Use um endereço completo começando com https://';
  }
  if (url.protocol !== 'https:') return 'O link de destino precisa começar com https://';
  if (!url.hostname.includes('.') || url.username || url.password) return 'Link de destino inválido.';
  if (url.toString().length > 500) return 'Link de destino muito longo (máximo 500 caracteres).';
  return null;
}

/** URL final do redirecionamento do link curto (com marcadores de origem). */
export function urlDeDestino(linkDestino: string, codigo: string, campanhaId: string): string {
  const url = new URL(linkDestino);
  url.searchParams.set('c', codigo);
  url.searchParams.set('utm_source', 'sms');
  url.searchParams.set('utm_medium', 'sms');
  url.searchParams.set('utm_campaign', campanhaId.replace(/-/g, '').slice(0, 8));
  return url.toString();
}

/** Planilha CSV: evita formula injection ao abrir no Excel. */
export function celulaCsvSegura(valor: unknown): string {
  let t = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}
