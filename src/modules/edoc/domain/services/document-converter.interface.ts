// src/modules/edoc/domain/services/document-converter.interface.ts
// Camada de DOMINIO: contrato sem saber que existe LibreOffice/child_process.
export interface IDocumentConverterService {
  convertToPdf(input: { buffer: Buffer; originalname: string }): Promise<Buffer>;
}
