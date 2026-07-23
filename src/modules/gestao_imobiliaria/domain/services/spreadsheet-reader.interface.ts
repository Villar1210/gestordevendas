// src/modules/gestao_imobiliaria/domain/services/spreadsheet-reader.interface.ts
// Camada de DOMINIO: contrato sem saber que existe exceljs/csv-parse (mesmo
// padrao de IDocumentConverterService no modulo edoc - ver
// libreoffice-converter.service.ts).
export interface ISpreadsheetReaderService {
  // Le um arquivo CSV ou XLSX e devolve uma linha por objeto, com as chaves
  // exatamente como apareceram no cabecalho (sem normalizacao - isso e
  // responsabilidade de domain/services/parse-planilha-imoveis.ts).
  read(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<
    Record<string, string>[]
  >;
}
