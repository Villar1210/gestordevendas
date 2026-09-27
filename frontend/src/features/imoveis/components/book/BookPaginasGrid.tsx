// src/features/imoveis/components/book/BookPaginasGrid.tsx
// Grade de paginas do book com a categoria de cada uma. As miniaturas sao
// desenhadas no NAVEGADOR a partir do proprio arquivo escolhido (react-pdf),
// sem baixar nada do servidor. Importado via next/dynamic com ssr:false
// (pdfjs so roda no navegador - ver PdfViewer.tsx do E-doc).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, Maximize2, X } from "lucide-react";
import { BOOK_CATEGORIA_OPTIONS } from "../../constants";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export interface PaginaRevisao {
  numero: number;
  categoria: string;
  legenda: string | null;
}

const COR: Record<string, string> = {
  fachada: "border-blue-500 bg-blue-50",
  area_comum: "border-emerald-500 bg-emerald-50",
  decorado: "border-violet-500 bg-violet-50",
  planta: "border-sky-500 bg-sky-50",
  localizacao: "border-teal-500 bg-teal-50",
  ficha_tecnica: "border-slate-500 bg-slate-100",
  descartar: "border-slate-200 bg-white opacity-60",
};

// So desenha a miniatura quando o card aparece na tela (books com 80 paginas).
function QuandoVisivel({ children, altura }: { children: React.ReactNode; altura: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visivel) return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        setVisivel(true);
        obs.disconnect();
      }
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visivel]);
  return (
    <div ref={ref} style={{ minHeight: altura }} className="flex items-center justify-center">
      {visivel ? children : <Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-hidden />}
    </div>
  );
}

interface Props {
  arquivo: File;
  paginas: PaginaRevisao[];
  onMudarCategoria: (numero: number, categoria: string) => void;
}

export function BookPaginasGrid({ arquivo, paginas, onMudarCategoria }: Props) {
  const [ampliada, setAmpliada] = useState<number | null>(null);
  // Um so "documento" para a grade inteira (o PDF e lido uma vez).
  const fonte = useMemo(() => arquivo, [arquivo]);

  useEffect(() => {
    if (ampliada === null) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAmpliada(null);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [ampliada]);

  return (
    <Document
      file={fonte}
      loading={
        <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o PDF...
        </p>
      }
      error={<p className="py-8 text-sm text-red-600">Não foi possível mostrar as páginas deste PDF.</p>}
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {paginas.map((p) => (
          <li key={p.numero} className={`overflow-hidden rounded-xl border-2 transition ${COR[p.categoria] ?? COR.descartar}`}>
            <div className="relative bg-white">
              <QuandoVisivel altura={150}>
                <Page
                  pageNumber={p.numero}
                  width={210}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<Loader2 className="h-5 w-5 animate-spin text-slate-300" />}
                />
              </QuandoVisivel>
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                Pág. {p.numero}
              </span>
              <button
                type="button"
                onClick={() => setAmpliada(p.numero)}
                aria-label={`Ampliar página ${p.numero}`}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1 p-2">
              <label className="sr-only" htmlFor={`cat-${p.numero}`}>
                Categoria da página {p.numero}
              </label>
              <select
                id={`cat-${p.numero}`}
                value={p.categoria}
                onChange={(e) => onMudarCategoria(p.numero, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600"
              >
                {BOOK_CATEGORIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {p.legenda && <p className="truncate text-xs text-slate-500" title={p.legenda}>{p.legenda}</p>}
            </div>
          </li>
        ))}
      </ul>

      {ampliada !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Página ${ampliada}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAmpliada(null)}
        >
          <div className="relative max-h-full overflow-auto rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              autoFocus
              onClick={() => setAmpliada(null)}
              aria-label="Fechar"
              className="absolute right-3 top-3 z-10 rounded-full bg-white p-1.5 text-slate-700 shadow"
            >
              <X className="h-4 w-4" />
            </button>
            <Page
              pageNumber={ampliada}
              width={Math.min(1000, typeof window !== "undefined" ? window.innerWidth - 64 : 1000)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        </div>
      )}
    </Document>
  );
}
