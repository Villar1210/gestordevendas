// src/modules/gestao_imobiliaria/domain/services/pdf-reader.interface.ts
// Camada de DOMINIO: contrato sem saber que existe pdf-parse (mesmo padrao
// de ISpreadsheetReaderService/IDocumentConverterService).
export interface IPdfReaderService {
  // Le um PDF e devolve o texto extraido (todas as paginas concatenadas).
  extractText(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string>;
}
