// src/modules/pdf_tools/domain/services/zip-builder.interface.ts
export interface ZipEntry {
  name: string;
  data: Buffer;
}

export interface IZipBuilder {
  build(entries: ZipEntry[]): Buffer;
}
