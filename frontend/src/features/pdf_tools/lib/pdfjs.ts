// src/features/pdf_tools/lib/pdfjs.ts
// Configura o worker do pdfjs (react-pdf 9 / pdfjs-dist 4.8 - ver
// CLAUDE.md, "PENDENCIA DE BUILD"). So pode ser importado por modulos
// carregados via next/dynamic({ ssr: false }): pdfjs quebra no SSR.
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjs };
