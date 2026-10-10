// src/modules/pdf_tools/domain/services/office-converter.interface.ts
export type OfficeExtension = 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'odt' | 'ods' | 'odp';

export interface IOfficeConverter {
  convertToPdf(input: { buffer: Buffer; extension: OfficeExtension }): Promise<Buffer>;
}
