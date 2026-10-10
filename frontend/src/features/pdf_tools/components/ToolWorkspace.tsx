// src/features/pdf_tools/components/ToolWorkspace.tsx
// Area de trabalho generica, guiada pelo catalogo:
// 1) sem arquivos → dropzone; 2) arquivos + painel de opcoes;
// 3) processando; 4) resultado. Erros em banner inline.
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, TriangleAlert, X } from "lucide-react";
import type { PdfTool } from "../catalog";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import { usePdfCapabilities, usePdfTool, validateIncomingFiles } from "../hooks/usePdfTool";
import { FileDropzone } from "./FileDropzone";
import { SelectedFiles } from "./SelectedFiles";
import { ToolOptionsPanel } from "./options/ToolOptionsPanel";
import { CreatePdfEditorBody, CreatePdfOptions } from "./CreatePdfEditor";
import { FileResultCard, ProcessingState, TextResultPanel } from "./ResultPanels";
import { ToolTile } from "./ToolTile";
import { OrganizePagesGrid, PdfPreview } from "./pdf/dynamic";

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [message]);
  return (
    <div ref={ref} role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="-m-1 rounded-md p-1 text-rose-500 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Breadcrumb({ tool }: { tool: PdfTool }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-slate-500">
        <li>
          <Link
            href="/dashboard/ferramentas-pdf"
            className="rounded hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Ferramentas PDF
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li aria-current="page" className="font-medium text-slate-800">
          {tool.title}
        </li>
      </ol>
    </nav>
  );
}

export function ToolWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfToolsStore((s) => s.files);
  const status = usePdfToolsStore((s) => s.status);
  const error = usePdfToolsStore((s) => s.error);
  const result = usePdfToolsStore((s) => s.result);
  const toolSlug = usePdfToolsStore((s) => s.toolSlug);
  const startTool = usePdfToolsStore((s) => s.startTool);
  const addFiles = usePdfToolsStore((s) => s.addFiles);
  const setError = usePdfToolsStore((s) => s.setError);
  const resetWork = usePdfToolsStore((s) => s.resetWork);
  const clearResult = usePdfToolsStore((s) => s.clearResult);
  const { run } = usePdfTool(tool);
  const caps = usePdfCapabilities();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    startTool(tool.slug, tool.defaultOptions);
  }, [tool, startTool]);

  // Descarta arquivos/Object URLs ao sair da ferramenta.
  useEffect(() => () => usePdfToolsStore.getState().resetWork(), []);

  const unavailable = tool.capability && caps ? !caps[tool.capability] : false;
  const ready = toolSlug === tool.slug;

  function handleFiles(incoming: File[]) {
    const current = usePdfToolsStore.getState().files.map((f) => f.file);
    if (!tool.multiple && current.length > 0) {
      resetWork();
    }
    const { accepted, error: problem } = validateIncomingFiles(tool, tool.multiple ? current : [], incoming);
    if (accepted.length) addFiles(accepted);
    if (problem) setError(problem);
  }

  function restart() {
    if (tool.kind === "create") clearResult();
    else resetWork();
    headingRef.current?.focus();
  }

  const processing = status === "processing";
  const needsMore = tool.kind === "upload" && files.length < tool.minFiles;

  let body: React.ReactNode;
  if (!ready) {
    body = null;
  } else if (processing) {
    body = <ProcessingState tool={tool} />;
  } else if (result?.type === "text") {
    body = <TextResultPanel result={result} onRestart={restart} />;
  } else if (result?.type === "file" && tool.kind === "create") {
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Prévia do PDF criado">
          <PdfPreview file={result.blob} />
        </section>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <FileResultCard tool={tool} result={result} onRestart={restart} />
        </div>
      </div>
    );
  } else if (result?.type === "file") {
    body = (
      <div className="mx-auto max-w-2xl">
        <FileResultCard tool={tool} result={result} onRestart={restart} />
      </div>
    );
  } else if (tool.kind === "upload" && files.length === 0) {
    body = (
      <div className="mx-auto max-w-3xl">
        <FileDropzone tool={tool} onFiles={handleFiles} disabled={unavailable} />
      </div>
    );
  } else {
    const showAddMore = tool.multiple && files.length < tool.maxFiles;
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label={tool.kind === "create" ? "Editor" : "Arquivos selecionados"} className="min-w-0">
          {tool.kind === "create" ? (
            <CreatePdfEditorBody />
          ) : tool.slug === "organizar" ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-100/60 p-4 sm:p-5">
              <OrganizePagesGrid file={files[0].file} />
            </div>
          ) : (
            <div className="space-y-4">
              <SelectedFiles tool={tool} />
              {showAddMore && <FileDropzone tool={tool} onFiles={handleFiles} variant="compact" />}
              {!tool.multiple && (
                <button
                  type="button"
                  onClick={resetWork}
                  className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Trocar arquivo
                </button>
              )}
            </div>
          )}
        </section>

        <aside aria-label="Opções" className="lg:sticky lg:top-6 lg:self-start">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white"
          >
            <div className="space-y-5 p-5">
              <h2 className="text-base font-semibold text-slate-900">Opções</h2>
              {tool.kind === "create" ? <CreatePdfOptions /> : <ToolOptionsPanel slug={tool.slug} />}
            </div>
            <div className="border-t border-slate-100 p-5">
              {tool.slug === "organizar" && files[0] && (
                <button
                  type="button"
                  onClick={resetWork}
                  className="mb-3 w-full text-center text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Trocar arquivo
                </button>
              )}
              <button
                type="submit"
                disabled={processing || needsMore || unavailable}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {tool.actionLabel}
              </button>
              {needsMore && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  Adicione ao menos {tool.minFiles} arquivos para continuar.
                </p>
              )}
            </div>
          </form>
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <Breadcrumb tool={tool} />
      <header className="mt-5 flex items-start gap-4">
        <ToolTile tool={tool} />
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-900 focus:outline-none sm:text-[1.75rem]">
            {tool.title}
          </h1>
          <p className="mt-1 max-w-2xl text-slate-500">{tool.description}</p>
        </div>
      </header>

      <div className="mt-8 space-y-5">
        {unavailable && (
          <div role="status" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Esta ferramenta está indisponível no servidor no momento. Fale com o administrador do sistema.
          </div>
        )}
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        {body}
      </div>
    </div>
  );
}
