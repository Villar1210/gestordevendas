// src/features/pdf_tools/components/pdf/PdfPreview.tsx
// Previa simples (todas as paginas, largura do container). Client-only.
"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { Loader2 } from "lucide-react";
import "../../lib/pdfjs";

export function PdfPreview({ file }: { file: Blob }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(560);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(200, Math.min(820, node.clientWidth - 32)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="max-h-[75vh] overflow-y-auto rounded-2xl bg-slate-200/70 p-4">
      <Document
        file={file}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4">
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="shadow-md shadow-slate-400/30">
              <Page pageNumber={i + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}
