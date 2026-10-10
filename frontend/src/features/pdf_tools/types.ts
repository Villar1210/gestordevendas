// src/features/pdf_tools/types.ts
export type OptionValue = string | number | boolean;
export type OptionValues = Record<string, OptionValue>;

export interface PdfToolsCapabilities {
  office: boolean;
  compress: boolean;
  security: boolean;
  raster: boolean;
}

export interface SelectedFile {
  id: string;
  file: File;
  // Paginas do PDF (preenchido quando a miniatura carrega).
  pages?: number;
  // Object URL da imagem (so Imagens para PDF) - revogado ao remover.
  previewUrl?: string;
  // PDF protegido por senha detectado na miniatura.
  locked?: boolean;
}

export interface OrganizePage {
  key: string; // estavel para o drag-and-drop
  index: number; // indice 0-based no PDF original
  rotate: 0 | 90 | 180 | 270;
}

export type ResultKind = "pdf" | "zip" | "image" | "other";

export interface FileResult {
  type: "file";
  blob: Blob;
  filename: string;
  url: string; // object URL - revogado no reset
  kind: ResultKind;
  meta: Record<string, string | number | boolean | null>;
  originalSize: number;
}

export interface TextResult {
  type: "text";
  pages: number;
  text: string;
  byPage: { page: number; text: string }[];
  sourceName: string;
}

export type ToolResult = FileResult | TextResult;

export type ToolStatus = "idle" | "processing" | "done" | "error";
