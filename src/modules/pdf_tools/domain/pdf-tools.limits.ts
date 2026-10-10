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
  pdfToImagesMaxFiles: 20,
  // Lote nas ferramentas de 1 PDF -> 1 PDF (comprimir, girar, numerar,
  // marca d'agua, proteger, desbloquear, extrair texto).
  batchMaxFiles: 20,
  // Office -> PDF: LibreOffice e lento e o nginx corta em 300s.
  officeBatchMaxFiles: 10,
  // Prazo TOTAL de um lote: o nginx corta em 300s (proxy_read_timeout);
  // abortamos antes para o usuario ver uma mensagem clara, nao um 504.
  batchDeadlineMs: 240_000,
  // Paginas: por arquivo (vale para TODAS as ferramentas, checado logo apos
  // carregar o PDF, antes de percorrer as paginas) e somadas no lote.
  maxPagesPerFile: 2000,
  batchMaxPagesTotal: 5000,
  // Texto extraido: por arquivo e somado no lote (vale tambem para 1 arquivo).
  extractTextMaxCharsPerFile: 2_000_000,
  extractTextMaxCharsTotal: 5_000_000,
  // Saida: soma dos resultados do lote / resultado de 1 arquivo.
  batchMaxOutputBytes: 150 * MB,
  maxOutputBytes: 120 * MB,
  // Rotas com lote: por USUARIO (nao por IP), alem dos 30/min por IP.
  batchThrottleLimit: 6,
  batchThrottleTtlMs: 60_000,
  // Rasterizacao: maximo de paginas por requisicao (TOTAL do lote). A 300 DPI cada pagina
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
