// src/modules/pdf_tools/domain/services/zip-builder.interface.ts
export interface ZipEntry {
  /** Nome do arquivo. Separadores ("/", "\\") sao neutralizados: nunca vira caminho. */
  name: string;
  data: Buffer;
  /**
   * Pasta (UM nivel) montada pelo proprio codigo, ex.: nome sanitizado do
   * PDF de origem. Tambem e sanitizada (sem separadores, sem "." / ".."
   * no inicio) - nunca permite traversal nem subpastas aninhadas.
   */
  folder?: string;
}

export interface IZipBuilder {
  build(entries: ZipEntry[]): Buffer;
}
