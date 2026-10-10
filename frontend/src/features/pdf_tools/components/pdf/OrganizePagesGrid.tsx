// src/features/pdf_tools/components/pdf/OrganizePagesGrid.tsx
// Grade de paginas do PDF para "Organizar paginas": arrastar para
// reordenar, girar e excluir por pagina. Client-only (via dynamic.tsx).
// O resultado vai para a store como [{ index, rotate }] na ordem final.
"use client";

import { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import { Loader2, Lock, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import "../../lib/pdfjs";
import { usePdfToolsStore } from "../../store/usePdfToolsStore";
import type { OrganizePage } from "../../types";
import { SortableGrid } from "../SortableGrid";
import { useInView } from "./PdfThumbnail";

const THUMB_WIDTH = 132;

function LazyPage({ pageNumber, rotate }: { pageNumber: number; rotate: number }) {
  const { ref, inView } = useInView<HTMLDivElement>("300px");
  const sideways = rotate === 90 || rotate === 270;
  return (
    <div ref={ref} className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
      {inView ? (
        <div
          className="shadow-md shadow-slate-300/60 transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: `rotate(${rotate}deg) scale(${sideways ? 0.72 : 0.92})` }}
        >
          <Page
            pageNumber={pageNumber}
            width={THUMB_WIDTH}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div className="bg-white" style={{ width: THUMB_WIDTH, height: THUMB_WIDTH * 1.414 }} />}
          />
        </div>
      ) : null}
    </div>
  );
}

function rotateBy(value: OrganizePage["rotate"], delta: 90 | -90): OrganizePage["rotate"] {
  return (((value + delta) % 360) + 360) % 360 as OrganizePage["rotate"];
}

export function OrganizePagesGrid({ file }: { file: File }) {
  const pages = usePdfToolsStore((s) => s.organizePages);
  const setPages = usePdfToolsStore((s) => s.setOrganizePages);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(false);
  const [removed, setRemoved] = useState<OrganizePage[]>([]);

  // Arquivo trocado: zera o historico de excluidas.
  useEffect(() => setRemoved([]), [file]);

  function handleLoad(numPages: number) {
    setTotal(numPages);
    const current = usePdfToolsStore.getState().organizePages;
    if (current.length === 0) {
      setPages(Array.from({ length: numPages }, (_, i) => ({ key: `p${i}`, index: i, rotate: 0 })));
    }
  }

  function update(key: string, change: (p: OrganizePage) => OrganizePage) {
    setPages(pages.map((p) => (p.key === key ? change(p) : p)));
  }

  function remove(page: OrganizePage) {
    if (pages.length <= 1) return;
    setPages(pages.filter((p) => p.key !== page.key));
    setRemoved((r) => [...r, page]);
  }

  function undoRemove() {
    const last = removed[removed.length - 1];
    if (!last) return;
    setRemoved((r) => r.slice(0, -1));
    setPages([...pages, last]);
  }

  function reorder(from: number, to: number) {
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPages(next);
  }

  const changed =
    pages.length !== total || pages.some((p, i) => p.index !== i || p.rotate !== 0);

  return (
    <Document
      file={file}
      onLoadSuccess={({ numPages }) => handleLoad(numPages)}
      onPassword={() => {
        setLocked(true);
        usePdfToolsStore.getState().setError(
          "Este PDF está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.",
        );
      }}
      loading={
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando páginas…
        </div>
      }
      error={
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.
        </p>
      }
    >
      {locked ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-rose-700">
          <Lock className="h-6 w-6" aria-hidden="true" />
          PDF protegido por senha.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pages.length}</span> de {total}{" "}
              {total === 1 ? "página" : "páginas"} · arraste para mudar a ordem
            </p>
            <div className="flex gap-2">
              {removed.length > 0 && (
                <button
                  type="button"
                  onClick={undoRemove}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Desfazer exclusão
                </button>
              )}
              {changed && (
                <button
                  type="button"
                  onClick={() => {
                    setRemoved([]);
                    setPages(Array.from({ length: total }, (_, i) => ({ key: `p${i}`, index: i, rotate: 0 })));
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Restaurar original
                </button>
              )}
            </div>
          </div>
          <SortableGrid
            idPrefix="paginas"
            items={pages}
            getKey={(p) => p.key}
            getLabel={(p, i) => `Página ${p.index + 1}, posição ${i + 1} de ${pages.length}. Pressione espaço para mover.`}
            minItemWidth={140}
            gap={14}
            onReorder={reorder}
            renderItem={(page, position, { isDragging }) => (
              <div
                className={`rounded-2xl border bg-white p-2 transition ${
                  isDragging ? "border-violet-400 shadow-xl shadow-violet-200/60" : "border-slate-200 shadow-sm hover:border-slate-300"
                }`}
              >
                <LazyPage pageNumber={page.index + 1} rotate={page.rotate} />
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="whitespace-nowrap pl-1 text-xs font-semibold text-slate-700">
                    {position + 1}
                    {page.index !== position && (
                      <span className="ml-1 font-normal text-slate-400" title={`Era a página ${page.index + 1}`}>
                        era {page.index + 1}
                      </span>
                    )}
                  </span>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => update(page.key, (p) => ({ ...p, rotate: rotateBy(p.rotate, -90) }))}
                      aria-label={`Girar página ${page.index + 1} para a esquerda`}
                      className="rounded-md p-1 text-slate-500 sm:p-1.5 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update(page.key, (p) => ({ ...p, rotate: rotateBy(p.rotate, 90) }))}
                      aria-label={`Girar página ${page.index + 1} para a direita`}
                      className="rounded-md p-1 text-slate-500 sm:p-1.5 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(page)}
                      disabled={pages.length <= 1}
                      aria-label={`Excluir página ${page.index + 1}`}
                      className="rounded-md p-1 text-slate-500 sm:p-1.5 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          />
        </>
      )}
    </Document>
  );
}
