// src/modules/gestao_imobiliaria/domain/services/book-empreendimento.ts
// Regras do "book" do empreendimento: o PDF de apresentacao da construtora
// (ou um conjunto de imagens JPG, uma por pagina) e separado pagina a pagina;
// cada pagina recebe uma categoria.

// Categorias que viram FOTO do empreendimento.
export const CATEGORIAS_FOTO_BOOK = ['fachada', 'area_comum', 'planta', 'decorado', 'localizacao'] as const;

// Todas as categorias possiveis de uma pagina (as 2 ultimas nao viram foto:
// a ficha tecnica vira DADOS e "descartar" e capa/logo/texto legal etc).
export const CATEGORIAS_PAGINA_BOOK = [...CATEGORIAS_FOTO_BOOK, 'ficha_tecnica', 'descartar'] as const;
export type CategoriaPaginaBook = (typeof CATEGORIAS_PAGINA_BOOK)[number];

export const BOOK_MAX_BYTES = 80 * 1024 * 1024; // 80 MB
export const BOOK_MAX_PAGINAS = 80;
// Quantas paginas vao para a IA com imagem (as demais vao so com texto).
export const BOOK_MAX_PAGINAS_COM_IMAGEM_IA = 60;
// Validade do PDF guardado entre "analisar" e "confirmar".
export const BOOK_VALIDADE_MS = 2 * 60 * 60 * 1000;

// Book enviado como IMAGENS (ex: fotos do celular, prints): 1 a 80 JPG/JPEG,
// cada pagina e uma imagem, na ordem em que chegaram.
export type OrigemBook = 'pdf' | 'imagens';
export const BOOK_MAX_IMAGENS = BOOK_MAX_PAGINAS;
export const BOOK_MAX_BYTES_POR_IMAGEM = 20 * 1024 * 1024; // 20 MB
// Protecao de memoria: lido do cabecalho ANTES de decodificar (uma imagem de
// 50 MP decodificada ocupa ~200 MB de RAM).
export const BOOK_MAX_PIXELS_IMAGEM = 50_000_000;
// Fotos gravadas (PDF renderizado ou imagem normalizada): boa para tela cheia
// no site, ~200-500 KB.
export const BOOK_LARGURA_FOTO = 1600;
export const BOOK_QUALIDADE_FOTO = 80;
// Ficha tecnica pela IA olhando as imagens: no maximo 10 paginas, ~1000 px.
export const BOOK_MAX_IMAGENS_FICHA = 10;
export const BOOK_LARGURA_IMAGEM_FICHA = 1000;
export const BOOK_QUALIDADE_IMAGEM_FICHA = 70;
// PDF com menos que isso de texto util (somando todas as paginas, sem
// espacos repetidos) e tratado como "PDF so de imagem": a ficha e lida pelas
// imagens das paginas.
export const BOOK_MIN_CARACTERES_TEXTO = 200;

// Paginas que alimentam a ficha tecnica, nessa ordem de relevancia.
export const ORDEM_PAGINAS_FICHA: readonly CategoriaPaginaBook[] = [
  'ficha_tecnica',
  'planta',
  'area_comum',
  'localizacao',
  'fachada',
];

// Escolhe as paginas cujas IMAGENS vao para a IA ler a ficha tecnica:
// primeiro as de categoria relevante (na ordem acima, e pelo numero dentro de
// cada categoria). Se a classificacao nao achou nenhuma (ex: a IA falhou e
// tudo virou "descartar"), usa as primeiras paginas do book.
export function selecionarPaginasParaFicha(
  paginas: { numero: number; categoria: string }[],
  max = BOOK_MAX_IMAGENS_FICHA,
): number[] {
  const peso = (c: string) => ORDEM_PAGINAS_FICHA.indexOf(c as CategoriaPaginaBook);
  const relevantes = paginas
    .filter((p) => peso(p.categoria) !== -1)
    .sort((a, b) => peso(a.categoria) - peso(b.categoria) || a.numero - b.numero)
    .map((p) => p.numero);
  if (relevantes.length > 0) return relevantes.slice(0, max);
  return [...paginas]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => p.numero)
    .slice(0, max);
}

// Quantidade de texto "util" do PDF (sem espacos repetidos).
export function caracteresUteis(textos: { texto: string }[]): number {
  return textos.reduce((total, t) => total + t.texto.replace(/\s+/g, ' ').trim().length, 0);
}

// Ordem de preferencia para escolher a CAPA (foto principal) de um
// empreendimento ou de uma unidade sem foto propria.
export const PRIORIDADE_CAPA: readonly string[] = ['fachada', 'area_comum', 'decorado', 'localizacao', 'planta'];

export function escolherCapa<T extends { categoria: string; order: number }>(fotos: T[]): T | null {
  if (fotos.length === 0) return null;
  const peso = (c: string) => {
    const i = PRIORIDADE_CAPA.indexOf(c);
    return i === -1 ? PRIORIDADE_CAPA.length : i;
  };
  return [...fotos].sort((a, b) => peso(a.categoria) - peso(b.categoria) || a.order - b.order)[0];
}

export function ehCategoriaDeFoto(c: string): c is (typeof CATEGORIAS_FOTO_BOOK)[number] {
  return (CATEGORIAS_FOTO_BOOK as readonly string[]).includes(c);
}
