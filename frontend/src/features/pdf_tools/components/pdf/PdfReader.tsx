// src/features/pdf_tools/components/pdf/PdfReader.tsx
// Leitor de PDF 100% local (nada vai ao servidor). Client-only - importar
// via dynamic.tsx. Barra: abrir, nome, pagina X de N, zoom, girar, baixar,
// tela cheia. Miniaturas a esquerda (md+), paginas no centro com rolagem
// sincronizada a pagina atual (IntersectionObserver).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Document, Page } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Loader2,
  Lock,
  Maximize,
  Minimize,
  MoveHorizontal,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import "../../lib/pdfjs";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { downloadBlob } from "../../lib/format";
import { PaperSheet } from "../PaperSheet";

interface PdfReaderProps {
  file: Blob | null;
  name: string;
  onOpenFile: (file: File) => void;
}

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const BASE_WIDTH = 816; // largura "100%" (aprox. A4 a 96 dpi)
const THUMB_WIDTH = 104;

function ToolbarButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

export function PdfReader({ file, name, onOpenFile }: PdfReaderProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const programmaticScroll = useRef(false);

  const [numPages, setNumPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [fullscreen, setFullscreen] = useState(false);
  const [state, setState] = useState<"ok" | "locked" | "error">("ok");
  const [aspect, setAspect] = useState(1.414);

  // Reinicia ao trocar de arquivo.
  useEffect(() => {
    setNumPages(0);
    setCurrent(1);
    setPageInput("1");
    setRotation(0);
    setState("ok");
    pageRefs.current.clear();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [file]);

  useEffect(() => setPageInput(String(current)), [current]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () => setContainerWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
    // O container so existe depois que o Document carrega.
  }, [file, numPages, state]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const sideways = rotation === 90 || rotation === 270;
  const available = Math.max(240, containerWidth - (containerWidth < 640 ? 24 : 64));
  // Largura do CANVAS da pagina: em 90/270 a altura vira largura na tela.
  const pageWidth = useMemo(() => {
    const target = fitWidth ? available : Math.round(BASE_WIDTH * zoom);
    return sideways ? Math.round(target / aspect) : target;
  }, [fitWidth, available, zoom, sideways, aspect]);
  const displayedWidth = sideways ? Math.round(pageWidth * aspect) : pageWidth;
  const effectiveZoom = displayedWidth / BASE_WIDTH;

  // Pagina atual = a que ocupa mais a area visivel.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || numPages === 0) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio));
        if (programmaticScroll.current) return;
        let best = 0;
        let bestRatio = 0;
        ratios.forEach((r, p) => {
          if (r > bestRatio) {
            bestRatio = r;
            best = p;
          }
        });
        if (best) setCurrent(best);
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, pageWidth]);

  // Mantem a miniatura atual visivel.
  useEffect(() => {
    const thumb = thumbsRef.current?.querySelector<HTMLElement>(`[data-thumb="${current}"]`);
    thumb?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const goTo = useCallback(
    (page: number) => {
      if (numPages === 0) return;
      const target = Math.min(Math.max(1, page), numPages);
      setCurrent(target);
      const el = pageRefs.current.get(target);
      if (el) {
        programmaticScroll.current = true;
        el.scrollIntoView({ block: "start" });
        window.setTimeout(() => {
          programmaticScroll.current = false;
        }, 120);
      }
    },
    [numPages],
  );

  function changeZoom(direction: 1 | -1) {
    const base = fitWidth ? effectiveZoom : zoom;
    const next =
      direction === 1
        ? ZOOM_STEPS.find((z) => z > base + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
        : [...ZOOM_STEPS].reverse().find((z) => z < base - 0.01) ?? ZOOM_STEPS[0];
    setFitWidth(false);
    setZoom(next);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      // Navegador sem suporte: ignora silenciosamente.
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "PageDown" || (e.key === "ArrowRight" && !e.altKey)) {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "PageUp" || (e.key === "ArrowLeft" && !e.altKey)) {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(1);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(numPages);
    }
  }

  const estimatedHeight = Math.round(displayedWidth * (sideways ? 1 / aspect : aspect));

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,application/pdf"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const picked = e.target.files?.[0];
        e.target.value = "";
        if (picked) onOpenFile(picked);
      }}
    />
  );

  return (
    <div
      ref={rootRef}
      className={`flex flex-col overflow-hidden border border-slate-200 bg-white ${
        fullscreen ? "h-screen w-screen" : "h-[calc(100dvh-10.5rem)] min-h-[28rem] rounded-3xl"
      }`}
    >
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Abrir</span>
        </button>
        {fileInput}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800" title={name}>
          {name || "Nenhum arquivo aberto"}
        </p>

        {file && state === "ok" && (
          <div className="flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-1">
              <ToolbarButton label="Página anterior" onClick={() => goTo(current - 1)} disabled={current <= 1}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <span className="sr-only">Página atual</span>
                <input
                  value={pageInput}
                  inputMode="numeric"
                  onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goTo(Number(pageInput) || 1);
                  }}
                  onBlur={() => setPageInput(String(current))}
                  className="h-8 w-11 rounded-md border border-slate-200 text-center text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="whitespace-nowrap">de {numPages || "–"}</span>
              </label>
              <ToolbarButton label="Próxima página" onClick={() => goTo(current + 1)} disabled={current >= numPages}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
            </div>

            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />

            <div className="flex items-center gap-0.5">
              <ToolbarButton label="Diminuir zoom" onClick={() => changeZoom(-1)} disabled={effectiveZoom <= ZOOM_STEPS[0] + 0.01}>
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <span className="w-11 text-center text-xs font-medium tabular-nums text-slate-600" aria-live="polite">
                {Math.round(effectiveZoom * 100)}%
              </span>
              <ToolbarButton label="Aumentar zoom" onClick={() => changeZoom(1)} disabled={effectiveZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.01}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Ajustar à largura" onClick={() => setFitWidth(true)} pressed={fitWidth}>
                <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Girar páginas" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Baixar PDF" onClick={() => downloadBlob(file, name || "documento.pdf")}>
                <Download className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
              </ToolbarButton>
            </div>
          </div>
        )}
      </div>

      {!file ? (
        <EmptyReader onPick={() => inputRef.current?.click()} onDrop={onOpenFile} />
      ) : (
        <Document
          file={file}
          className="flex min-h-0 min-w-0 flex-1"
          onLoadSuccess={async (pdf) => {
            setNumPages(pdf.numPages);
            try {
              const first = await pdf.getPage(1);
              const [x0, y0, x1, y1] = first.view;
              const rotated = first.rotate % 180 !== 0;
              const ratio = rotated ? (x1 - x0) / (y1 - y0) : (y1 - y0) / (x1 - x0);
              if (Number.isFinite(ratio) && ratio > 0) setAspect(ratio);
            } catch {
              // mantem a proporcao A4
            }
          }}
          onLoadError={() => setState("error")}
          onPassword={() => setState("locked")}
          loading={
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden="true" /> Abrindo o PDF…
            </div>
          }
          error={<ReaderMessage title="Não foi possível abrir este arquivo" text="Verifique se é um PDF válido e tente outro." />}
        >
          {state === "locked" ? (
            <ReaderMessage
              locked
              title="PDF protegido por senha"
              text="Use a ferramenta Desbloquear PDF para remover a senha e depois abra aqui."
            />
          ) : (
            <div className="flex min-h-0 w-full min-w-0 flex-1">
              {/* Miniaturas */}
              <nav
                ref={thumbsRef}
                aria-label="Miniaturas das páginas"
                className="hidden w-40 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 px-3 py-4 md:block"
              >
                <ol className="space-y-3">
                  {Array.from({ length: numPages }, (_, i) => {
                    const page = i + 1;
                    const active = page === current;
                    return (
                      <li key={page} data-thumb={page}>
                        <button
                          type="button"
                          onClick={() => goTo(page)}
                          aria-label={`Ir para a página ${page}`}
                          aria-current={active ? "page" : undefined}
                          className="group flex w-full flex-col items-center gap-1.5 rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span
                            className={`block overflow-hidden rounded-sm bg-white shadow-sm ring-2 transition ${
                              active ? "ring-blue-600" : "ring-transparent group-hover:ring-slate-300"
                            }`}
                          >
                            <LazyThumb page={page} rotate={rotation} aspect={aspect} />
                          </span>
                          <span className={`text-xs tabular-nums ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}>
                            {page}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Paginas */}
              <div
                ref={scrollRef}
                tabIndex={0}
                role="region"
                aria-label={`Documento ${name}`}
                onKeyDown={handleKeyDown}
                className="min-w-0 flex-1 overflow-auto bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              >
                <div className="flex min-w-fit flex-col items-center gap-4 px-3 py-4 sm:px-8 sm:py-6">
                  {Array.from({ length: numPages }, (_, i) => {
                    const page = i + 1;
                    return (
                      <div
                        key={page}
                        data-page={page}
                        ref={(el) => {
                          if (el) pageRefs.current.set(page, el);
                          else pageRefs.current.delete(page);
                        }}
                        className="scroll-mt-4 bg-white shadow-md shadow-slate-400/30"
                        style={{ minHeight: estimatedHeight, width: displayedWidth }}
                      >
                        <LazyPage page={page} width={pageWidth} rotate={rotation} placeholderHeight={estimatedHeight} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Document>
      )}
    </div>
  );
}

// So renderiza o canvas quando a pagina chega perto da area visivel.
function useNearViewport<T extends Element>(margin: string) {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: margin,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, margin]);
  return { ref, near };
}

function LazyPage({ page, width, rotate, placeholderHeight }: { page: number; width: number; rotate: number; placeholderHeight: number }) {
  const { ref, near } = useNearViewport<HTMLDivElement>("800px 0px");
  return (
    <div ref={ref}>
      {near ? (
        <Page
          pageNumber={page}
          width={width}
          rotate={rotate}
          loading={<div style={{ height: placeholderHeight }} />}
        />
      ) : (
        <div style={{ height: placeholderHeight }} />
      )}
    </div>
  );
}

function LazyThumb({ page, rotate, aspect }: { page: number; rotate: number; aspect: number }) {
  const { ref, near } = useNearViewport<HTMLSpanElement>("400px 0px");
  const sideways = rotate === 90 || rotate === 270;
  const width = sideways ? Math.round(THUMB_WIDTH / aspect) : THUMB_WIDTH;
  const height = sideways ? Math.round(THUMB_WIDTH / aspect) : Math.round(THUMB_WIDTH * aspect);
  return (
    <span ref={ref} className="block" style={{ width: THUMB_WIDTH, minHeight: height }}>
      {near && (
        <Page
          pageNumber={page}
          width={width}
          rotate={rotate}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<span className="block" style={{ height }} />}
        />
      )}
    </span>
  );
}

function ReaderMessage({ title, text, locked }: { title: string; text: string; locked?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      {locked && <Lock className="h-8 w-8 text-rose-500" aria-hidden="true" />}
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
    </div>
  );
}

function EmptyReader({ onPick, onDrop }: { onPick: () => void; onDrop: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="flex flex-1 items-center justify-center bg-slate-50 p-4 sm:p-8"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onDrop(dropped);
      }}
    >
      <button
        type="button"
        onClick={onPick}
        className={`flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
          dragging ? "border-blue-400 bg-blue-50/60" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <PaperSheet tone="bg-blue-50 text-blue-700" size="lg" stacked>
          <FolderOpen className="h-10 w-10" strokeWidth={1.5} />
        </PaperSheet>
        <span>
          <span className="block text-lg font-semibold text-slate-900">Arraste um PDF aqui</span>
          <span className="mt-1 block text-sm text-slate-500">
            ou <span className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4">clique para abrir</span>
          </span>
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          O arquivo é lido no seu navegador e não é enviado ao servidor
        </span>
      </button>
    </div>
  );
}
