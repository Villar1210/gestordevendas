// src/modules/gestao_imobiliaria/domain/services/parse-planilha-imoveis.ts
// Camada de DOMINIO: funcoes puras, sem Prisma/NestJS/exceljs/csv-parse. Opera
// so sobre linhas ja extraidas como Record<string,string> (a leitura real do
// arquivo CSV/XLSX e responsabilidade da infra - ver
// domain/services/spreadsheet-reader.interface.ts) - assim o parsing
// determinístico das regras de negocio fica testavel e independente do
// formato de origem do arquivo.

import { UnidadeGerada } from './gerar-lote-imoveis';

// NFKD (nao NFD) de proposito: alem de separar acentos de letras (á -> a +
// acento combinante), NFKD tambem decompoe caracteres de compatibilidade
// como "²" (superscript two, U+00B2) em "2" comum - necessario pra casar o
// cabecalho real da planilha ("M²") sem hardcode do caractere especial.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// So letras/numeros, sem espacos/hifens/barras - usado para comparar codigos
// curtos (status, enquadramento) tolerando variacoes de grafia como
// "HIS-2" vs "HIS2", "R2v" vs "R2V".
function normalizarCodigoCurto(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]/g, '');
}

export type IdentificadorParseResultado =
  | { valido: true; tipoItem: string; bloco: string | null; andar: number | null; numeroNoAndar: number | null }
  | { valido: false; motivo: string };

const MOTIVO_PADRAO_NAO_RECONHECIDO =
  'Identificador nao bate com nenhum padrao reconhecido (esperado "VG-..." para vaga avulsa ou "BL{bloco}-{andar}{numero}" para unidade).';

// Sufixo com menos de 3 digitos nao da pra separar andar de unidade com
// seguranca (ex: "BL02-08" pode ser terreo/unidade 8 OU um identificador
// malformado de outra fonte - nunca visto nos dados reais ate hoje).
// Decisao confirmada com o usuario: marcar como erro de parsing em vez de
// assumir terreo silenciosamente.
const MOTIVO_SUFIXO_AMBIGUO =
  'Identificador ambiguo, sufixo numerico muito curto para separar andar de unidade - verifique manualmente.';

// Regras (confirmadas com o usuario antes de implementar):
// - "VG-..." -> vaga avulsa, sem bloco/andar/numeroNoAndar.
// - "BL{bloco}-{sufixo numerico}" -> unidade, so quando o sufixo tiver PELO
//   MENOS 3 digitos. Os ULTIMOS 2 digitos do sufixo sao sempre o numero da
//   unidade no andar; o restante e o andar (podendo ser "0", ex:
//   "BL02-0008" -> terreo).
// - Sufixo com menos de 3 digitos, ou qualquer formato fora dos 2 acima ->
//   invalido (erro de parsing, tratado pelo caller).
export function parseIdentificador(identificadorBruto: string): IdentificadorParseResultado {
  const identificador = identificadorBruto.trim().toUpperCase();

  if (identificador.startsWith('VG-')) {
    return { valido: true, tipoItem: 'vaga_avulsa', bloco: null, andar: null, numeroNoAndar: null };
  }

  const match = identificador.match(/^(BL\d+)-(\d+)$/);
  if (!match) {
    return { valido: false, motivo: MOTIVO_PADRAO_NAO_RECONHECIDO };
  }

  const bloco = match[1];
  const sufixo = match[2];
  if (sufixo.length < 3) {
    return { valido: false, motivo: MOTIVO_SUFIXO_AMBIGUO };
  }

  const numeroNoAndar = Number(sufixo.slice(-2));
  const andar = Number(sufixo.slice(0, -2));

  return { valido: true, tipoItem: 'unidade', bloco, andar, numeroNoAndar };
}

const ENQUADRAMENTO_CODES = new Set(['his2', 'hmp', 'r2v']);

// A coluna ENQUADRAMENTO pode trazer "R2V / PCD" (pcd embutido, separado por
// barra) ou so "Vaga avulsa" (que NAO e um enquadramento de verdade - so
// reflexo de a linha ser uma vaga, ver enunciado da fatia). Vazio/nulo ou
// qualquer texto que nao bata com um dos 3 codigos reconhecidos vira NENHUM.
export function normalizeEnquadramentoEPcd(raw: string | undefined | null): {
  enquadramento: string;
  pcd: boolean;
} {
  if (!raw || !raw.trim()) return { enquadramento: 'nenhum', pcd: false };

  const partes = raw.split('/').map((parte) => parte.trim());
  const pcd = partes.some((parte) => normalizarCodigoCurto(parte) === 'pcd');
  const parteEnquadramento = partes.find((parte) => normalizarCodigoCurto(parte) !== 'pcd') ?? '';
  const codigo = normalizarCodigoCurto(parteEnquadramento);

  return { enquadramento: ENQUADRAMENTO_CODES.has(codigo) ? codigo : 'nenhum', pcd };
}

// Espelha STATUS_VALUES de create-imovel.dto.ts (mesma fonte de verdade da
// Fatia 1) - cada chave e o texto do label em pt-BR normalizado (sem acento,
// minusculo, espacos viram "_").
const STATUS_LABEL_TO_VALUE: Record<string, string> = {
  disponivel: 'disponivel',
  reservado: 'reservado',
  em_negociacao: 'em_negociacao',
  vendido: 'vendido',
  bloqueado: 'bloqueado',
  em_analise: 'em_analise',
  distrato: 'distrato',
  ocupado: 'ocupado',
  vago: 'vago',
  inativo: 'inativo',
};

// null = status nao reconhecido (erro de parsing, tratado pelo caller) -
// diferente de "coluna vazia", que o caller trata separadamente com o
// default "disponivel".
export function normalizeStatus(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return null;
  const chave = normalizarTexto(raw).replace(/\s+/g, '_');
  return STATUS_LABEL_TO_VALUE[chave] ?? null;
}

// "R$ 372.700" -> 372700, "R$ 1.234,56" -> 1234.56. Formato monetario
// brasileiro: "." separador de milhar (removido), "," separador decimal
// (vira ".").
export function parseValorMonetario(raw: string | undefined | null): number | null {
  if (!raw || !raw.trim()) return null;
  const limpo = raw
    .replace(/r\$\s?/gi, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isNaN(numero) ? null : numero;
}

function parseNumeroSimples(raw: string | undefined | null): number | null {
  if (!raw || !raw.trim()) return null;
  const numero = Number(raw.trim().replace(',', '.'));
  return Number.isNaN(numero) ? null : numero;
}

// Aceita variacoes de grafia dos cabecalhos reais de exportacoes (Looker
// Studio e afins nem sempre usam exatamente o mesmo texto/acentuacao).
const COLUNA_ALIASES: Record<string, string[]> = {
  produto: ['produto'],
  identificador: ['identificador'],
  area: ['m²', 'm2', 'area', 'área'],
  dormitorios: ['dormitorios', 'dormitórios', 'dorm', 'dorms'],
  enquadramento: ['enquadramento'],
  vagas: ['vagas'],
  status: ['status'],
  valorTabela: ['valor do imovel', 'valor do imóvel', 'valor tabela', 'valor de tabela'],
  valorComDesconto: ['valor com desconto'],
  tipologia: ['tipologia'],
};

// Mapeia os cabecalhos REAIS do arquivo (como vieram, com acento/maiuscula
// originais) para os nomes de campo canonicos usados por LinhaPlanilhaBruta -
// calculado uma vez a partir da 1a linha, reaproveitado para todas as linhas.
export function mapearCabecalho(headers: string[]): Partial<Record<string, string>> {
  const headersNormalizados = headers.map((original) => ({
    original,
    chave: normalizarTexto(original),
  }));
  const mapeamento: Partial<Record<string, string>> = {};
  for (const [campo, aliases] of Object.entries(COLUNA_ALIASES)) {
    const aliasesNormalizados = aliases.map(normalizarTexto);
    const encontrado = headersNormalizados.find((h) => aliasesNormalizados.includes(h.chave));
    if (encontrado) mapeamento[campo] = encontrado.original;
  }
  return mapeamento;
}

// Fatia 3b: valores distintos da coluna PRODUTO, na ordem de 1a aparicao no
// arquivo - usado pelo frontend para o usuario escolher qual produto
// corresponde ao empreendimento de destino ANTES de pedir o preview
// filtrado (ver ListarProdutosPlanilhaUseCase).
export function extrairProdutosDistintos(
  rows: Record<string, string>[],
  mapeamento: Partial<Record<string, string>>,
): string[] {
  const header = mapeamento.produto;
  if (!header) return [];

  const vistos = new Set<string>();
  const produtos: string[] = [];
  for (const row of rows) {
    const valor = (row[header] ?? '').trim();
    if (valor && !vistos.has(valor)) {
      vistos.add(valor);
      produtos.push(valor);
    }
  }
  return produtos;
}

// Uma linha da planilha ja com os campos relevantes extraidos pelo leitor de
// infra (ISpreadsheetReaderService) - ainda sem nenhuma normalizacao de
// dominio aplicada.
export interface LinhaPlanilhaBruta {
  linha: number;
  produto: string;
  identificador: string;
  area?: string;
  dormitorios?: string;
  enquadramento?: string;
  vagas?: string;
  status?: string;
  valorTabela?: string;
  valorComDesconto?: string;
  // Opcional - so algumas planilhas trazem essa coluna (ver enunciado).
  tipologia?: string;
}

export interface LinhaPlanilhaErro {
  linha: number;
  identificador: string;
  motivo: string;
}

// Aplica o mapeamento de cabecalho (ver mapearCabecalho) a uma linha bruta
// (Record<string,string> com as chaves ORIGINAIS do arquivo) para produzir
// uma LinhaPlanilhaBruta com nomes de campo canonicos.
export function converterLinhaBruta(
  row: Record<string, string>,
  mapeamento: Partial<Record<string, string>>,
  numeroLinha: number,
): LinhaPlanilhaBruta {
  const valor = (campo: string): string | undefined => {
    const header = mapeamento[campo];
    return header ? row[header] : undefined;
  };

  return {
    linha: numeroLinha,
    produto: valor('produto') ?? '',
    identificador: valor('identificador') ?? '',
    area: valor('area'),
    dormitorios: valor('dormitorios'),
    enquadramento: valor('enquadramento'),
    vagas: valor('vagas'),
    status: valor('status'),
    valorTabela: valor('valorTabela'),
    valorComDesconto: valor('valorComDesconto'),
    tipologia: valor('tipologia'),
  };
}

export type ResultadoLinhaPlanilha =
  | { tipo: 'unidade'; unidade: UnidadeGerada }
  | { tipo: 'erro'; erro: LinhaPlanilhaErro }
  // Linha de outro PRODUTO - filtrada silenciosamente (nao e erro).
  | { tipo: 'ignorada' };

export function parseLinhaPlanilha(
  linha: LinhaPlanilhaBruta,
  produtoFiltro: string,
): ResultadoLinhaPlanilha {
  if (linha.produto.trim() !== produtoFiltro.trim()) {
    return { tipo: 'ignorada' };
  }

  const identificadorExterno = linha.identificador.trim();

  const identificadorParseado = parseIdentificador(identificadorExterno);
  if (!identificadorParseado.valido) {
    return {
      tipo: 'erro',
      erro: {
        linha: linha.linha,
        identificador: identificadorExterno,
        motivo: identificadorParseado.motivo,
      },
    };
  }

  const statusNormalizado = normalizeStatus(linha.status);
  if (linha.status && linha.status.trim() && !statusNormalizado) {
    return {
      tipo: 'erro',
      erro: {
        linha: linha.linha,
        identificador: identificadorExterno,
        motivo: `Status "${linha.status}" nao reconhecido.`,
      },
    };
  }

  const { enquadramento, pcd: pcdDoEnquadramento } = normalizeEnquadramentoEPcd(
    linha.enquadramento,
  );
  // Sinal adicional de PCD vindo da coluna TIPOLOGIA (ex: "Tipo 1Q PCD"),
  // quando essa coluna existir no arquivo.
  const pcdDaTipologia = linha.tipologia ? /\bpcd\b/i.test(linha.tipologia) : false;
  const pcd = pcdDoEnquadramento || pcdDaTipologia;

  const tipologia = linha.tipologia?.trim();
  const title = tipologia ? `${tipologia} - ${identificadorExterno}` : identificadorExterno;

  const unidade: UnidadeGerada = {
    identificadorExterno,
    bloco: identificadorParseado.bloco,
    andar: identificadorParseado.andar,
    numeroNoAndar: identificadorParseado.numeroNoAndar,
    title,
    tipo: 'apartamento',
    finalidade: 'venda',
    status: statusNormalizado ?? 'disponivel',
    tipoItem: identificadorParseado.tipoItem,
    enquadramento,
    pcd,
    area: parseNumeroSimples(linha.area),
    bedrooms: parseNumeroSimples(linha.dormitorios),
    vagasIncluidas: parseNumeroSimples(linha.vagas) ?? 0,
    valorTabela: parseValorMonetario(linha.valorTabela),
    valorComDesconto: parseValorMonetario(linha.valorComDesconto),
    customFields: tipologia ? { tipologia } : {},
  };

  return { tipo: 'unidade', unidade };
}
