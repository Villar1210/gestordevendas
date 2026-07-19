// src/modules/gestao_imobiliaria/domain/services/normalize-endereco.ts
// Camada de DOMINIO: funcoes puras, sem Prisma/NestJS. Usadas pela busca de
// empreendimento por endereco da VIVI (modulo vivi_sdr, tool
// "buscar_empreendimento_por_endereco") para comparar o texto livre do lead
// contra rua/numero cadastrados no catalogo (Empreendimento/Imovel), sem
// geocodificacao - so correspondencia de texto tolerante a abreviacoes,
// acentuacao, maiusculas/minusculas e pequenas diferencas de grafia.

// Abreviacoes comuns de logradouro no Brasil -> forma por extenso, para
// que "Av." e "Avenida" (ou "R." e "Rua") sejam tratados como identicos.
// Ordem importa: entradas mais especificas (ex: "alam.") antes de
// prefixos mais curtos que poderiam casar por engano.
const ABREVIACOES: Array<[RegExp, string]> = [
  [/\bav\.?\b/g, 'avenida'],
  [/\br\.?\b/g, 'rua'],
  [/\bal\.?\b/g, 'alameda'],
  [/\balam\.?\b/g, 'alameda'],
  [/\btv\.?\b/g, 'travessa'],
  [/\btrav\.?\b/g, 'travessa'],
  [/\bpc\.?\b/g, 'praca'],
  [/\bpca\.?\b/g, 'praca'],
  [/\brod\.?\b/g, 'rodovia'],
  [/\best\.?\b/g, 'estrada'],
];

// Faixa Unicode dos sinais diacriticos combinantes (acentos) apos
// normalizar em NFD - visualmente parece "vazio" no editor, mas e o
// intervalo correto (confirmado via codePointAt: 0x0300-0x036f).
function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Minusculo, sem acento, abreviacoes expandidas, so letras/numeros/espacos,
// espacos colapsados. Aplicada tanto no texto buscado quanto em cada
// endereco do catalogo antes de comparar (nenhum dos dois lados fica "cru").
export function normalizeEnderecoTexto(texto: string): string {
  let normalizado = removerAcentos(texto.toLowerCase());
  for (const [padrao, substituicao] of ABREVIACOES) {
    normalizado = normalizado.replace(padrao, substituicao);
  }
  normalizado = normalizado.replace(/[^a-z0-9\s]/g, ' ');
  normalizado = normalizado.replace(/\s+/g, ' ').trim();
  return normalizado;
}

export interface EnderecoExtraido {
  logradouro: string;
  numero: string | null;
}

// Extrai o numero (primeira sequencia numerica isolada) do texto ja
// normalizado - o restante (sem o numero) e tratado como o nome do
// logradouro, para comparar separadamente da rua/bairro do catalogo.
export function extrairLogradouroENumero(enderecoNormalizado: string): EnderecoExtraido {
  const match = enderecoNormalizado.match(/\b(\d+)\b/);
  if (!match) {
    return { logradouro: enderecoNormalizado, numero: null };
  }
  const numero = match[1];
  const logradouro = (
    enderecoNormalizado.slice(0, match.index) + enderecoNormalizado.slice(match.index! + numero.length)
  )
    .replace(/\s+/g, ' ')
    .trim();
  return { logradouro, numero };
}

// Distancia de Levenshtein classica (numero minimo de edicoes) - sem
// dependencia nova, so ~15 linhas, suficiente para tolerar pequenas
// diferencas de grafia (ex: "cursino" vs "curssino").
function distanciaLevenshtein(a: string, b: string): number {
  const matriz: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + custo,
      );
    }
  }
  return matriz[a.length][b.length];
}

// 1.0 = identico, 0.0 = completamente diferente.
export function calcularSimilaridade(a: string, b: string): number {
  if (a === b) return 1;
  const maiorTamanho = Math.max(a.length, b.length);
  if (maiorTamanho === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / maiorTamanho;
}

const SIMILARIDADE_MINIMA = 0.75;

// O numero, quando informado na busca, e um filtro EXATO (poucas ruas
// parecidas compartilham o mesmo numero na mesma cidade) - a tolerancia a
// "pequenas diferencas de grafia" se aplica so ao nome do logradouro.
export function enderecoCorresponde(
  query: EnderecoExtraido,
  candidato: { rua: string; numero: string },
): boolean {
  if (query.numero !== null) {
    const numeroCandidato = normalizeEnderecoTexto(candidato.numero).replace(/\D/g, '');
    if (query.numero !== numeroCandidato) {
      return false;
    }
  }

  const ruaCandidatoNormalizada = normalizeEnderecoTexto(candidato.rua);
  return calcularSimilaridade(query.logradouro, ruaCandidatoNormalizada) >= SIMILARIDADE_MINIMA;
}
