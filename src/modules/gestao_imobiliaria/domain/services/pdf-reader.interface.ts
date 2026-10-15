// src/modules/gestao_imobiliaria/domain/services/pdf-reader.interface.ts
// Camada de DOMINIO: contrato sem saber que existe pdf-parse (mesmo padrao
// de ISpreadsheetReaderService/IDocumentConverterService).

export interface PaginaTextoPdf {
  numero: number; // comeca em 1
  texto: string;
}

export interface PaginaImagemPdf {
  numero: number;
  jpeg: Buffer;
  largura: number;
  altura: number;
}

export interface IPdfReaderService {
  // Le um PDF e devolve o texto extraido (todas as paginas concatenadas).
  extractText(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string>;

  // Quantidade de paginas do PDF (sem renderizar nada).
  contarPaginas(pdf: Buffer): Promise<number>;

  // Texto pagina a pagina (book do empreendimento: cada pagina e analisada
  // separadamente). Le no maximo as primeiras `maxPaginas` paginas (protecao
  // contra PDF com milhares de paginas) e devolve o total REAL do documento,
  // para quem chama recusar o que passar do limite.
  lerTextoPorPagina(
    pdf: Buffer,
    opcoes: { maxPaginas: number },
  ): Promise<{ totalPaginas: number; paginas: PaginaTextoPdf[] }>;

  // "Fotografa" as paginas pedidas como JPEG na largura indicada (a altura
  // segue a proporcao da pagina).
  renderizarPaginas(
    pdf: Buffer,
    paginas: number[],
    opcoes: { larguraPx: number; qualidadeJpeg: number },
  ): Promise<PaginaImagemPdf[]>;
}
