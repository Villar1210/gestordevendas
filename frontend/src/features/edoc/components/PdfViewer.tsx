// src/features/edoc/components/PdfViewer.tsx
// Isolado em componente proprio, importado via next/dynamic com ssr:false
// pelos consumidores - pdfjs-dist executa codigo especifico de navegador
// (Worker, canvas) na avaliacao do modulo, que quebra em runtime durante o
// SSR do Next.js ("Object.defineProperty called on non-object"). Nao ha
// como contornar isso so com config de bundler - o pacote precisa ficar de
// fora da renderizacao no servidor. Movido de src/app/assinar/[token]/ na
// Fatia 2 para ser reaproveitado tambem pelo editor de posicionamento.
"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface HighlightField {
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

interface PdfViewerProps {
  documentUrl: string;
  // Retangulo destacado (borda tracejada amber) sobre a pagina indicada -
  // usado na tela publica de assinatura para mostrar onde a assinatura vai
  // aparecer. A pagina correspondente recebe scroll automatico.
  highlightField?: HighlightField;
}

export function PdfViewer({ documentUrl, highlightField }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const highlightPageRef = useRef<HTMLDivElement | null>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (highlightField && highlightPageRef.current && !hasScrolled.current) {
      highlightPageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      hasScrolled.current = true;
    }
  }, [numPages, highlightField]);

  return (
    <Document
      file={documentUrl}
      onLoadSuccess={({ numPages: total }) => setNumPages(total)}
      loading={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      }
    >
      {Array.from({ length: numPages }, (_, i) => {
        const pageNumber = i + 1;
        const isHighlightedPage = highlightField?.pageNumber === pageNumber;
        return (
          <div
            key={i}
            ref={isHighlightedPage ? highlightPageRef : undefined}
            className="relative mb-2"
          >
            <Page pageNumber={pageNumber} width={680} />
            {isHighlightedPage && highlightField && (
              <div
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-blue-600 bg-blue-400/10"
                style={{
                  left: `${highlightField.xPercent * 100}%`,
                  top: `${highlightField.yPercent * 100}%`,
                  width: `${highlightField.widthPercent * 100}%`,
                  height: `${highlightField.heightPercent * 100}%`,
                }}
              />
            )}
          </div>
        );
      })}
    </Document>
  );
}
