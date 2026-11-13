// src/modules/campanhas_sms/domain/services/sms-texto.ts
// Montagem e contagem do texto do SMS (dominio puro).
// GSM-7 (padrao 3GPP 23.038): 160 caracteres em 1 SMS, 153 por parte quando
// passa disso; os caracteres da tabela de extensao contam 2. Qualquer caractere
// fora do GSM-7 (a maioria dos acentos do portugues, cedilha minusculo, emoji)
// muda a codificacao para UCS-2: 70 em 1 SMS, 67 por parte, contando unidades
// UTF-16 (emoji = 2). Por isso o primeiro nome e sempre gravado SEM acento.

const GSM7_BASICO = new Set(
  Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
      '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
  ),
);
const GSM7_EXTENSAO = new Set(Array.from('^{}\\[~]|€\f'));

export const VARIAVEL_NOME = '{primeiro_nome}';
export const VARIAVEL_LINK = '{link}';
export const MAX_PRIMEIRO_NOME = 12;
// Tamanho do codigo do link curto (o pior caso usa exatamente este tamanho).
export const TAMANHO_CODIGO = 6;

export type Codificacao = 'GSM7' | 'UCS2';

export interface AnaliseTexto {
  codificacao: Codificacao;
  // Unidades contadas na codificacao (GSM7: septetos; UCS2: unidades UTF-16)
  tamanho: number;
  segmentos: number;
  // Caracteres que forcaram UCS-2 (sem repeticao, no maximo 10) - para a tela.
  caracteresForaDoGsm: string[];
}

export function analisarTexto(texto: string): AnaliseTexto {
  let septetos = 0;
  const fora = new Set<string>();
  for (const ch of Array.from(texto)) {
    if (GSM7_BASICO.has(ch)) septetos += 1;
    else if (GSM7_EXTENSAO.has(ch)) septetos += 2;
    else fora.add(ch);
  }
  if (fora.size === 0) {
    const segmentos = septetos === 0 ? 0 : septetos <= 160 ? 1 : Math.ceil(septetos / 153);
    return { codificacao: 'GSM7', tamanho: septetos, segmentos, caracteresForaDoGsm: [] };
  }
  const unidades = texto.length; // String.length ja conta unidades UTF-16
  const segmentos = unidades <= 70 ? 1 : Math.ceil(unidades / 67);
  return { codificacao: 'UCS2', tamanho: unidades, segmentos, caracteresForaDoGsm: Array.from(fora).slice(0, 10) };
}

/**
 * Primeiro nome pronto para o SMS: sem acento (transliterado), so letras,
 * capitalizado, no maximo 12 caracteres. "  JOÃO  pedro" -> "Joao".
 */
export function primeiroNomeParaSms(nome: string | null | undefined): string {
  const primeira = String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z\s'-]/g, ' ')
    .trim()
    .split(/\s+/)[0] ?? '';
  if (!primeira) return '';
  const cap = primeira.charAt(0).toUpperCase() + primeira.slice(1).toLowerCase();
  return cap.slice(0, MAX_PRIMEIRO_NOME);
}

export function montarMensagem(modelo: string, dados: { primeiroNome: string; link: string }): string {
  // Sem nome, "Oi {primeiro_nome}!" vira "Oi!" em vez de "Oi !".
  const nome = dados.primeiroNome.trim();
  let texto = modelo;
  if (!nome) texto = texto.replace(/\s*\{primeiro_nome\}/g, '');
  return texto.split(VARIAVEL_NOME).join(nome).split(VARIAVEL_LINK).join(dados.link);
}

export interface ValidacaoModelo {
  ok: boolean;
  erro?: string;
}

export function validarModelo(modelo: string): ValidacaoModelo {
  const t = modelo.trim();
  if (!t) return { ok: false, erro: 'Escreva a mensagem do SMS.' };
  if (!t.includes(VARIAVEL_LINK)) return { ok: false, erro: 'A mensagem precisa ter {link} (o link curto de cada contato).' };
  const links = t.split(VARIAVEL_LINK).length - 1;
  if (links > 1) return { ok: false, erro: 'Use {link} uma única vez.' };
  const variaveis = t.match(/\{[^}]*\}/g) ?? [];
  const desconhecida = variaveis.find((v) => v !== VARIAVEL_LINK && v !== VARIAVEL_NOME);
  if (desconhecida) return { ok: false, erro: `Variável desconhecida: ${desconhecida}. Use só {primeiro_nome} e {link}.` };
  return { ok: true };
}

/**
 * Pior caso da campanha: o maior primeiro nome da lista + o link no tamanho
 * real. E por este texto que se decide se cabe em maxSegmentos.
 */
export function analisarPiorCaso(modelo: string, maiorPrimeiroNome: string, baseLink: string): AnaliseTexto & { exemplo: string } {
  const exemplo = montarMensagem(modelo, {
    primeiroNome: maiorPrimeiroNome,
    link: `${baseLink}/${'X'.repeat(TAMANHO_CODIGO)}`,
  });
  return { ...analisarTexto(exemplo), exemplo };
}
