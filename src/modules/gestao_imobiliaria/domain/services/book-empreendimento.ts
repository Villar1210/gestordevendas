// src/modules/gestao_imobiliaria/domain/services/book-empreendimento.ts
// Regras do "book" do empreendimento: o PDF de apresentacao da construtora
// e separado pagina a pagina; cada pagina recebe uma categoria.

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
