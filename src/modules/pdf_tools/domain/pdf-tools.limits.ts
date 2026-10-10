// src/modules/pdf_tools/domain/pdf-tools.limits.ts
// Limites de negocio do modulo (puros, sem dependencia externa). O
// controller usa os mesmos valores para configurar o multer.
export const MB = 1024 * 1024;

export const PDF_TOOLS_LIMITS = {
  maxFileBytes: 50 * MB,
  maxRequestBytes: 80 * MB,
  mergeMinFiles: 2,
  mergeMaxFiles: 20,
  imagesMinFiles: 1,
  imagesMaxFiles: 50,
  // Rasterizacao: maximo de paginas por requisicao. A 300 DPI cada pagina
  // A4 vira ~2480x3508 px - limite menor para nao estourar a memoria.
  rasterMaxPages: 100,
  rasterMaxPagesAt300Dpi: 15,
  watermarkTextMin: 1,
  watermarkTextMax: 60,
  passwordMin: 4,
  passwordMax: 64,
  createContentMax: 50_000,
  createTitleMax: 120,
  createFontSizeMin: 10,
  createFontSizeMax: 16,
  startAtMax: 100_000,
} as const;
