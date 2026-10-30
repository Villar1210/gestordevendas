// src/modules/gestao_imobiliaria/domain/services/construtora.ts
// Camada de DOMINIO (pura, sem Nest/Prisma): regras do cadastro de
// Construtoras (Fatia A - ver docs/construtoras/CONTRATO_CONSTRUTORAS.md).

export const CONSTRUTORA_NOME_MAX = 150;
export const CONSTRUTORA_SITE_MAX = 255;
export const CONSTRUTORA_SOBRE_MAX = 2000;
export const CONSTRUTORA_DIFERENCIAIS_MAX = 1500;
// Logo: mesmos tipos das fotos (JPG/PNG/WebP pelos bytes), ate 2 MB.
export const CONSTRUTORA_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA = 'Construtora não encontrada.';
export const MENSAGEM_CONSTRUTORA_DUPLICADA = 'Já existe uma construtora com esse nome.';
export const MENSAGEM_CONSTRUTORA_NOME_OBRIGATORIO = 'Informe o nome da construtora.';
export const MENSAGEM_CONSTRUTORA_SITE_INVALIDO = 'O site da construtora deve começar com https://.';

// Espacos considerados na normalizacao: os ASCII + U+00A0 (espaco "duro" de
// texto colado do Word/navegador). E exatamente o conjunto que a migration
// 20261030120000_construtoras usa no backfill ([[:space:] ]) - as duas
// normalizacoes TEM de bater, senao o backfill e a aplicacao discordam.
const ESPACOS = /[ \t\n\v\f\r ]+/g;
const MARCAS_COMBINANTES = /[̀-ͯ]/g;

// Nome normalizado (chave de unicidade por tenant): sem acento, minusculas,
// espacos colapsados, sem espaco nas pontas. "  NOVO  Lár " -> "novo lar".
export function normalizarNomeConstrutora(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .toLowerCase()
    .replace(ESPACOS, ' ')
    .replace(/^ | $/g, '');
}

// Nome para exibicao: so tira espacos repetidos/nas pontas (mantem caixa e
// acentos como o usuario digitou).
export function limparNomeConstrutora(nome: string): string {
  return nome.replace(ESPACOS, ' ').replace(/^ | $/g, '');
}

// Texto livre opcional: vazio/so espacos vira null.
export function textoOuNull(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = valor.trim();
  return limpo ? limpo : null;
}

// Site so https (e so exibido como link - o servidor nunca busca a url).
export function siteValido(site: string): boolean {
  if (site.length > CONSTRUTORA_SITE_MAX) return false;
  try {
    const url = new URL(site);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Regra do DELETE (decisao do Villar, 30/10/2026): com empreendimento
// vinculado, BLOQUEIA (409) dizendo quantos sao.
export function mensagemConstrutoraComVinculo(quantidade: number): string {
  const palavra = quantidade === 1 ? 'empreendimento' : 'empreendimentos';
  return `Esta construtora tem ${quantidade} ${palavra}. Troque a construtora deles antes de excluir.`;
}
