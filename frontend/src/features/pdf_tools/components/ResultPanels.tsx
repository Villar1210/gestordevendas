// src/features/pdf_tools/components/ResultPanels.tsx
// Etapa 3 (processando) e etapa 4 (resultado: arquivo ou texto).
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, CircleCheck, Copy, Download, FileArchive, FileImage, FileText, Loader2, RefreshCw } from "lucide-react";
import type { PdfTool } from "../catalog";
import { getCategory } from "../catalog";
import type { FileResult, TextDocument, TextResult } from "../types";
import { baseName, downloadBlob, formatBytes, triggerDownload } from "../lib/format";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import { PaperSheet } from "./PaperSheet";

export function ProcessingState({ tool, fileCount = 1 }: { tool: PdfTool; fileCount?: number }) {
  const category = getCategory(tool.category);
  const Icon = tool.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center"
    >
      <div className="relative">
        <PaperSheet tone={category.tile} size="lg" stacked>
          <Icon className="h-10 w-10" strokeWidth={1.5} />
        </PaperSheet>
        <span className="absolute -bottom-2 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-7 text-lg font-semibold text-slate-900">{tool.progressLabel}</p>
      <p className="mt-1 text-sm text-slate-500">
        {tool.batch && fileCount > 1
          ? `Processando ${fileCount} arquivos, um de cada vez. Pode levar ${tool.slug === "office-para-pdf" ? "alguns minutos" : "alguns segundos"}. Não feche esta página.`
          : "Arquivos grandes podem levar alguns segundos. Não feche esta página."}
      </p>
    </div>
  );
}

function metaNumber(meta: FileResult["meta"], key: string): number | null {
  const v = meta[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function FileResultCard({ tool, result, onRestart }: { tool: PdfTool; result: FileResult; onRestart: () => void }) {
  const router = useRouter();
  const setReaderSource = usePdfToolsStore((s) => s.setReaderSource);
  const size = metaNumber(result.meta, "resultSize") ?? result.blob.size;
  const original = metaNumber(result.meta, "originalSize") ?? result.originalSize;
  const pages = metaNumber(result.meta, "pages");
  const sourceFiles = metaNumber(result.meta, "files");
  const imagesSummary =
    tool.slug === "pdf-para-imagem" && pages && sourceFiles
      ? `${pages} ${pages === 1 ? "imagem" : "imagens"} de ${sourceFiles} ${sourceFiles === 1 ? "PDF" : "PDFs"}`
      : null;
  // Lote das ferramentas 1 -> 1: varios arquivos chegam num .zip.
  const batchCount = tool.batch && tool.slug !== "pdf-para-imagem" && sourceFiles && sourceFiles > 1 ? sourceFiles : null;
  // No lote, alreadyOptimized e QUANTOS ja estavam otimizados (numero).
  const optimizedCount = metaNumber(result.meta, "alreadyOptimized") ?? 0;
  const alreadyOptimized =
    tool.slug === "comprimir" &&
    (batchCount ? optimizedCount >= batchCount || (original > 0 && size >= original) : result.meta.alreadyOptimized === true);
  const reduction = tool.slug === "comprimir" && original > 0 && !alreadyOptimized ? Math.max(0, 1 - size / original) : null;
  const title = alreadyOptimized
    ? batchCount
      ? "Estes PDFs já estavam otimizados"
      : "Este PDF já estava otimizado"
    : batchCount
      ? (tool.doneLabelBatch ?? tool.doneLabel)
      : tool.doneLabel;
  const detail = batchCount
    ? `${batchCount} arquivos processados${pages ? ` · ${pages} ${pages === 1 ? "página" : "páginas"}` : ""}`
    : imagesSummary ?? (pages ? `${pages} ${pages === 1 ? "página" : "páginas"}` : "");

  const KindIcon = result.kind === "zip" ? FileArchive : result.kind === "image" ? FileImage : tool.icon;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col items-center px-6 pb-8 pt-12 text-center">
        <div className="relative">
          <PaperSheet tone="bg-emerald-50 text-emerald-600" size="lg">
            <KindIcon className="h-10 w-10" strokeWidth={1.5} />
          </PaperSheet>
          <span className="absolute -bottom-2 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-4 ring-white">
            <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
          </span>
        </div>
        <h2 className="mt-7 text-xl font-semibold text-slate-900" role="status">
          {title}
        </h2>
        <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-700" title={result.filename}>
          {result.filename}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {batchCount && result.kind === "zip" ? `${formatBytes(result.blob.size)} (.zip)` : formatBytes(size)}
          {detail ? ` · ${detail}` : ""}
          {result.kind === "zip" && !batchCount ? " · arquivo .zip" : ""}
        </p>

        {reduction !== null && (
          <div className="mt-6 w-full max-w-sm">
            {batchCount && <p className="mb-1.5 text-left text-xs font-medium text-slate-500">Redução total dos {batchCount} PDFs</p>}
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-500">
                {formatBytes(original)} → <span className="font-semibold text-slate-800">{formatBytes(size)}</span>
              </span>
              <span className="text-lg font-bold text-emerald-700">−{Math.round(reduction * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (1 - reduction) * 100)}%` }} />
            </div>
          </div>
        )}
        {alreadyOptimized && (
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            {batchCount
              ? "Não deu para reduzir mais sem perder qualidade, então devolvemos os arquivos originais."
              : "Não deu para reduzir mais sem perder qualidade, então devolvemos o arquivo original."}
          </p>
        )}
        {!alreadyOptimized && batchCount && optimizedCount > 0 && (
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            {optimizedCount === 1
              ? "1 arquivo já estava otimizado e foi mantido como o original."
              : `${optimizedCount} arquivos já estavam otimizados e foram mantidos como os originais.`}
          </p>
        )}

        <div className="mt-8 flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => triggerDownload(result.url, result.filename)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {result.kind === "zip" && batchCount ? "Baixar .zip" : "Baixar"}
          </button>
          {/* So quando o resultado e 1 PDF (no lote vem um .zip). */}
          {result.kind === "pdf" && (
            <button
              type="button"
              onClick={() => {
                setReaderSource({ blob: result.blob, name: result.filename });
                router.push("/dashboard/ferramentas-pdf/leitor");
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Abrir no leitor
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {batchCount ? "Processar outros arquivos" : "Processar outro arquivo"}
        </button>
      </div>
    </div>
  );
}

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setCopyError(false);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      setCopyError(true);
    }
  }
  return { copiedKey, copyError, copy };
}

function DocumentText({ doc, label }: { doc: TextDocument; label: string }) {
  if (!doc.text.trim()) {
    return (
      <p className="px-5 py-12 text-center text-sm text-slate-500">
        Nenhum texto encontrado. Se o PDF for uma digitalização (foto de papel), ele não tem texto selecionável.
      </p>
    );
  }
  return (
    <div
      tabIndex={0}
      aria-label={label}
      className="max-h-[60vh] overflow-y-auto px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      {doc.byPage.length > 1 ? (
        doc.byPage.map((p) => (
          <section key={p.page} className="mb-6 last:mb-0">
            <h3 className="mb-2 text-xs font-semibold text-slate-400">Página {p.page}</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{p.text || "—"}</p>
          </section>
        ))
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{doc.text}</p>
      )}
    </div>
  );
}

const btnSecondary =
  "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-50 sm:flex-none";
const btnPrimary =
  "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-50 sm:flex-none";

/** Texto de todos os PDFs num .txt, com separadores "===== nome.pdf =====". */
export function joinDocumentsText(docs: TextDocument[]): string {
  return docs.map((d) => `===== ${d.name} =====\n\n${d.text}`).join("\n\n");
}

export function TextResultPanel({ tool, result, onRestart }: { tool: PdfTool; result: TextResult; onRestart: () => void }) {
  const { docs } = result;
  const batch = docs.length > 1;
  const [active, setActive] = useState(0);
  const { copiedKey, copyError, copy } = useCopy();
  const doc = docs[Math.min(active, docs.length - 1)];
  const docEmpty = !doc.text.trim();
  const allEmpty = docs.every((d) => !d.text.trim());
  const totalPages = docs.reduce((sum, d) => sum + d.pages, 0);
  const totalChars = docs.reduce((sum, d) => sum + d.text.length, 0);
  const tabsId = "texto-extraido";

  function downloadDoc(d: TextDocument) {
    downloadBlob(new Blob([d.text], { type: "text/plain;charset=utf-8" }), `${baseName(d.name)}.txt`);
  }

  function downloadAll() {
    downloadBlob(new Blob([joinDocumentsText(docs)], { type: "text/plain;charset=utf-8" }), "textos_extraidos.txt");
  }

  function onTabKey(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = docs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`${tabsId}-tab-${next}`)?.focus();
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CircleCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-900" role="status">
              {batch ? (tool.doneLabelBatch ?? tool.doneLabel) : tool.doneLabel}
            </h2>
            <p className="text-sm text-slate-500">
              {batch && `${docs.length} arquivos processados · `}
              {totalPages} {totalPages === 1 ? "página" : "páginas"} · {totalChars.toLocaleString("pt-BR")} caracteres
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {batch ? (
            <button type="button" onClick={downloadAll} disabled={allEmpty} className={btnPrimary}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar tudo (.txt)
            </button>
          ) : (
            <>
              <button type="button" onClick={() => copy("0", doc.text)} disabled={docEmpty} className={btnSecondary}>
                {copiedKey === "0" ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copiedKey === "0" ? "Copiado" : "Copiar"}
              </button>
              <button type="button" onClick={() => downloadDoc(doc)} disabled={docEmpty} className={btnPrimary}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Baixar .txt
              </button>
            </>
          )}
        </div>
      </div>
      {copyError && (
        <p className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-sm text-rose-700">
          O navegador bloqueou a cópia. Selecione o texto abaixo e use Ctrl+C.
        </p>
      )}

      {batch ? (
        <>
          <div className="border-b border-slate-100 bg-slate-50/60 px-3 pt-2">
            <div role="tablist" aria-label="Arquivos" className="-mb-px flex gap-1 overflow-x-auto">
              {docs.map((d, i) => {
                const selected = i === active;
                return (
                  <button
                    key={d.name}
                    id={`${tabsId}-tab-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${tabsId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(i)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    title={d.name}
                    className={`flex max-w-[16rem] shrink-0 items-center gap-2 rounded-t-xl border px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      selected
                        ? "border-slate-200 border-b-white bg-white text-slate-900"
                        : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800"
                    }`}
                  >
                    <FileText className={`h-4 w-4 shrink-0 ${selected ? "text-blue-700" : "text-slate-400"}`} aria-hidden="true" />
                    <span className="truncate">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${active}`}>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate text-sm text-slate-500">
                <span className="font-medium text-slate-800">{doc.name}</span> · {doc.pages}{" "}
                {doc.pages === 1 ? "página" : "páginas"} · {doc.text.length.toLocaleString("pt-BR")} caracteres
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => copy(String(active), doc.text)} disabled={docEmpty} className={`${btnSecondary} h-9`}>
                  {copiedKey === String(active) ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiedKey === String(active) ? "Copiado" : "Copiar"}
                </button>
                <button type="button" onClick={() => downloadDoc(doc)} disabled={docEmpty} className={`${btnSecondary} h-9`}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  .txt
                </button>
              </div>
            </div>
            <DocumentText doc={doc} label={`Texto extraído de ${doc.name}`} />
          </div>
        </>
      ) : (
        <DocumentText doc={doc} label="Texto extraído do PDF" />
      )}

      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {batch ? "Processar outros arquivos" : "Processar outro arquivo"}
        </button>
      </div>
    </div>
  );
}
