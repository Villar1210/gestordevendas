// src/features/pdf_tools/components/pdf/PdfThumbnail.tsx
// Miniatura da 1a pagina de um PDF local. Client-only: importar SEMPRE via
// next/dynamic({ ssr: false }) - ver lib/pdfjs.ts. So carrega o PDF quando
// o card entra na tela (IntersectionObserver).
"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { FileWarning, Loader2, Lock } from "lucide-react";
import "../../lib/pdfjs";

interface PdfThumbnailProps {
  file: Blob;
  width: number;
  pageNumber?: number;
  rotate?: number;
  onLoaded?: (numPages: number) => void;
  onLocked?: () => void;
}

export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

function Placeholder({ width, children }: { width: number; children?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center bg-slate-100 text-slate-400"
      style={{ width, height: Math.round(width * 1.414) }}
    >
      {children}
    </div>
  );
}

export function PdfThumbnail({ file, width, pageNumber = 1, rotate = 0, onLoaded, onLocked }: PdfThumbnailProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [state, setState] = useState<"ok" | "locked" | "error">("ok");

  return (
    <div ref={ref} className="overflow-hidden bg-white" style={{ width }}>
      {!inView ? (
        <Placeholder width={width} />
      ) : state === "locked" ? (
        <Placeholder width={width}>
          <span className="flex flex-col items-center gap-1 px-2 text-center text-[11px] font-medium text-rose-600">
            <Lock className="h-5 w-5" aria-hidden="true" />
            Protegido por senha
          </span>
        </Placeholder>
      ) : state === "error" ? (
        <Placeholder width={width}>
          <span className="flex flex-col items-center gap-1 px-2 text-center text-[11px] font-medium text-slate-500">
            <FileWarning className="h-5 w-5" aria-hidden="true" />
            Sem prévia
          </span>
        </Placeholder>
      ) : (
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => onLoaded?.(numPages)}
          onLoadError={() => setState("error")}
          // Nao usa o prompt() padrao do react-pdf: so marca como protegido.
          onPassword={() => {
            setState("locked");
            onLocked?.();
          }}
          loading={
            <Placeholder width={width}>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </Placeholder>
          }
          error={<Placeholder width={width} />}
        >
          <Page
            pageNumber={pageNumber}
            width={width}
            rotate={rotate}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<Placeholder width={width} />}
          />
        </Document>
      )}
    </div>
  );
}
