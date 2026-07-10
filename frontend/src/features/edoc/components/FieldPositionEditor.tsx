// src/features/edoc/components/FieldPositionEditor.tsx
// Client-only (importado via next/dynamic com ssr:false no
// CreateEnvelopeModal) - mesmo motivo do PdfViewer.tsx. Renderiza uma
// pagina do PDF por vez, com navegacao, e uma caixa arrastavel/
// redimensionavel (react-rnd) por destinatario sobre a pagina atual.
"use client";

import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Rnd } from "react-rnd";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface FieldPosition {
  recipientIndex: number;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

const PAGE_WIDTH = 640;

interface FieldPositionEditorProps {
  documentUrl: string;
  recipientNames: string[];
  fields: FieldPosition[];
  onChange: (fields: FieldPosition[]) => void;
}

export function FieldPositionEditor({
  documentUrl,
  recipientNames,
  fields,
  onChange,
}: FieldPositionEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  function updateField(recipientIndex: number, patch: Partial<FieldPosition>) {
    onChange(
      fields.map((field) =>
        field.recipientIndex === recipientIndex ? { ...field, ...patch } : field,
      ),
    );
  }

  function handleDragOrResizeStop(
    recipientIndex: number,
    pxX: number,
    pxY: number,
    pxWidth: number,
    pxHeight: number,
  ) {
    const container = pageContainerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    updateField(recipientIndex, {
      xPercent: Math.max(0, Math.min(1, pxX / width)),
      yPercent: Math.max(0, Math.min(1, pxY / height)),
      widthPercent: Math.max(0.05, Math.min(1, pxWidth / width)),
      heightPercent: Math.max(0.03, Math.min(1, pxHeight / height)),
    });
  }

  const fieldsOnCurrentPage = fields.filter((field) => field.pageNumber === currentPage);

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-slate-600">
          Pagina {currentPage} de {numPages || "..."}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Proxima pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex justify-center overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div ref={pageContainerRef} className="relative shrink-0">
          <Document
            file={documentUrl}
            onLoadSuccess={({ numPages: total }) => setNumPages(total)}
            loading={
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              </div>
            }
          >
            <Page pageNumber={currentPage} width={PAGE_WIDTH} />
          </Document>

          {fieldsOnCurrentPage.map((field) => {
            const container = pageContainerRef.current;
            const size = container?.getBoundingClientRect();
            const width = size?.width ?? PAGE_WIDTH;
            const height = size?.height ?? PAGE_WIDTH * 1.41;
            return (
              <Rnd
                key={field.recipientIndex}
                bounds="parent"
                size={{ width: field.widthPercent * width, height: field.heightPercent * height }}
                position={{ x: field.xPercent * width, y: field.yPercent * height }}
                onDragStop={(_e, d) =>
                  handleDragOrResizeStop(
                    field.recipientIndex,
                    d.x,
                    d.y,
                    field.widthPercent * width,
                    field.heightPercent * height,
                  )
                }
                onResizeStop={(_e, _dir, ref, _delta, pos) =>
                  handleDragOrResizeStop(
                    field.recipientIndex,
                    pos.x,
                    pos.y,
                    ref.offsetWidth,
                    ref.offsetHeight,
                  )
                }
                className="flex items-center justify-center rounded-md border-2 border-dashed border-amber-600 bg-amber-400/20 text-xs font-medium text-amber-800"
              >
                {recipientNames[field.recipientIndex]}
              </Rnd>
            );
          })}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {fields.map((field) => (
          <div
            key={field.recipientIndex}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <span className="text-slate-700">{recipientNames[field.recipientIndex]}</span>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Pagina do campo:
              <select
                value={field.pageNumber}
                onChange={(e) =>
                  updateField(field.recipientIndex, { pageNumber: Number(e.target.value) })
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 outline-none focus:border-amber-600"
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
