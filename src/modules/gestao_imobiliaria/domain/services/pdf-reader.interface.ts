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

  // Texto pagina a pagina (book do empreendimento: cada pagina e analisada
  // separadamente).
  lerTextoPorPagina(pdf: Buffer): Promise<PaginaTextoPdf[]>;

  // "Fotografa" as paginas pedidas como JPEG na largura indicada (a altura
  // segue a proporcao da pagina).
  renderizarPaginas(
    pdf: Buffer,
    paginas: number[],
    opcoes: { larguraPx: number; qualidadeJpeg: number },
  ): Promise<PaginaImagemPdf[]>;
}
