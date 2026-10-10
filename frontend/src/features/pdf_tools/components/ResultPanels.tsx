// src/features/pdf_tools/components/ResultPanels.tsx
// Etapa 3 (processando) e etapa 4 (resultado: arquivo ou texto).
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, CircleCheck, Copy, Download, FileArchive, FileImage, Loader2, RefreshCw } from "lucide-react";
import type { PdfTool } from "../catalog";
import { getCategory } from "../catalog";
import type { FileResult, TextResult } from "../types";
import { baseName, downloadBlob, formatBytes, triggerDownload } from "../lib/format";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import { PaperSheet } from "./PaperSheet";

export function ProcessingState({ tool }: { tool: PdfTool }) {
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
      <p className="mt-1 text-sm text-slate-500">Arquivos grandes podem levar alguns segundos. Não feche esta página.</p>
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
  const alreadyOptimized = result.meta.alreadyOptimized === true;
  const reduction = tool.slug === "comprimir" && original > 0 && !alreadyOptimized ? Math.max(0, 1 - size / original) : null;

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
          {alreadyOptimized ? "Este PDF já estava otimizado" : tool.doneLabel}
        </h2>
        <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-700" title={result.filename}>
          {result.filename}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {formatBytes(size)}
          {pages ? ` · ${pages} ${pages === 1 ? "página" : "páginas"}` : ""}
          {result.kind === "zip" ? " · arquivo .zip" : ""}
        </p>

        {reduction !== null && (
          <div className="mt-6 w-full max-w-sm">
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
            Não deu para reduzir mais sem perder qualidade, então devolvemos o arquivo original.
          </p>
        )}

        <div className="mt-8 flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => triggerDownload(result.url, result.filename)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar
          </button>
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
          Processar outro arquivo
        </button>
      </div>
    </div>
  );
}

export function TextResultPanel({ result, onRestart }: { result: TextResult; onRestart: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const empty = !result.text.trim();

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  function downloadTxt() {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${baseName(result.sourceName)}.txt`);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CircleCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-900" role="status">Texto extraído</h2>
            <p className="text-sm text-slate-500">
              {result.pages} {result.pages === 1 ? "página" : "páginas"} · {result.text.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            disabled={empty}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-50 sm:flex-none"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={downloadTxt}
            disabled={empty}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-50 sm:flex-none"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar .txt
          </button>
        </div>
      </div>
      {copyError && (
        <p className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-sm text-rose-700">
          O navegador bloqueou a cópia. Selecione o texto abaixo e use Ctrl+C.
        </p>
      )}
      {empty ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">
          Nenhum texto encontrado. Se o PDF for uma digitalização (foto de papel), ele não tem texto selecionável.
        </p>
      ) : (
        <div
          tabIndex={0}
          aria-label="Texto extraído do PDF"
          className="max-h-[60vh] overflow-y-auto px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          {result.byPage.length > 1 ? (
            result.byPage.map((p) => (
              <section key={p.page} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold text-slate-400">Página {p.page}</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{p.text || "—"}</p>
              </section>
            ))
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{result.text}</p>
          )}
        </div>
      )}
      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Processar outro arquivo
        </button>
      </div>
    </div>
  );
}
