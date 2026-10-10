// src/features/pdf_tools/components/PdfToolsHub.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX, ShieldCheck } from "lucide-react";
import {
  PDF_TOOL_CATEGORIES,
  PDF_TOOLS,
  READER_TOOL,
  getCategory,
  normalizeSearch,
  toolHref,
  type PdfTool,
  type PdfToolCategoryId,
} from "../catalog";
import { usePdfCapabilities } from "../hooks/usePdfTool";
import type { PdfToolsCapabilities } from "../types";
import { ToolTile } from "./ToolTile";
import { PaperSheet } from "./PaperSheet";

type Filter = "todas" | PdfToolCategoryId;

function isAvailable(tool: PdfTool, caps: PdfToolsCapabilities | null): boolean {
  if (!tool.capability || !caps) return true;
  return caps[tool.capability];
}

function ToolCard({ tool, available }: { tool: PdfTool; available: boolean }) {
  const category = getCategory(tool.category);
  const content = (
    <>
      <ToolTile tool={tool} />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{tool.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{tool.description}</p>
        {!available && (
          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Indisponível no servidor
          </span>
        )}
      </div>
      {available && (
        <ArrowRight
          aria-hidden="true"
          className={`mt-1 h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${category.accentText}`}
        />
      )}
    </>
  );

  if (!available) {
    return (
      <div
        aria-disabled="true"
        title="Esta ferramenta depende de um programa que não está instalado no servidor."
        className="flex h-full cursor-not-allowed items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 opacity-60 grayscale"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={toolHref(tool)}
      className={`group flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 ring-0 ring-transparent transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70 hover:ring-4 focus-visible:outline-none focus-visible:ring-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${category.ring}`}
    >
      {content}
    </Link>
  );
}

function ReaderFeature() {
  return (
    <Link
      href={toolHref(READER_TOOL)}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-blue-200 bg-white p-6 transition hover:shadow-lg hover:shadow-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-5 sm:items-center">
      <div className="shrink-0">
        <PaperSheet tone="bg-blue-50 text-blue-700" size="md" stacked>
          <READER_TOOL.icon className="h-8 w-8" strokeWidth={1.75} />
        </PaperSheet>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-slate-900">Leitor de PDF</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
          Abra qualquer PDF com miniaturas, zoom e tela cheia. A leitura acontece no seu navegador.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          O arquivo não é enviado ao servidor
        </p>
      </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-blue-800 sm:self-center">
        Abrir um PDF
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function PdfToolsHub() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const caps = usePdfCapabilities();

  const tools = useMemo(() => PDF_TOOLS.filter((t) => t.kind !== "reader"), []);
  const normalized = normalizeSearch(query);

  const visible = useMemo(
    () =>
      tools.filter((tool) => {
        if (filter !== "todas" && tool.category !== filter) return false;
        if (!normalized) return true;
        const haystack = normalizeSearch(`${tool.title} ${tool.description} ${tool.keywords}`);
        return normalized.split(/\s+/).every((word) => haystack.includes(word));
      }),
    [tools, filter, normalized],
  );

  // Sem busca: agrupa por categoria (o titulo da secao diz o que e cada grupo).
  const grouped = !normalized;
  const sections = PDF_TOOL_CATEGORIES.filter((c) => c.id !== "ler")
    .map((category) => ({ category, items: visible.filter((t) => t.category === category.id) }))
    .filter((s) => s.items.length > 0);

  const chips: { id: Filter; label: string; dot?: string }[] = [
    { id: "todas", label: "Todas" },
    ...PDF_TOOL_CATEGORIES.filter((c) => c.id !== "ler").map((c) => ({ id: c.id, label: c.label, dot: c.dot })),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ferramentas PDF</h1>
        <p className="mt-2 text-slate-500">
          Tudo o que você precisa para trabalhar com PDF — direto no Gestor de Vendas.
        </p>
      </header>

      <div className="mt-6 max-w-3xl">
        <label htmlFor="busca-ferramentas" className="sr-only">
          Buscar ferramenta
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="busca-ferramentas"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: juntar, comprimir, senha…"
            autoComplete="off"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      <div role="group" aria-label="Filtrar por categoria" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {chip.dot && <span className={`h-2 w-2 rounded-full ${chip.dot}`} aria-hidden="true" />}
              {chip.label}
            </button>
          );
        })}
      </div>

      {filter === "todas" && !normalized && (
        <div className="mt-8">
          <ReaderFeature />
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {normalized ? `${visible.length} ferramentas encontradas` : ""}
      </div>

      {visible.length === 0 ? (
        <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <PaperSheet tone="bg-slate-100 text-slate-400" size="md">
            <SearchX className="h-7 w-7" strokeWidth={1.75} />
          </PaperSheet>
          <h2 className="mt-5 font-semibold text-slate-900">Nenhuma ferramenta para “{query.trim()}”</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Tente outra palavra, como “unir”, “senha” ou “imagem”.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("todas");
            }}
            className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Ver todas as ferramentas
          </button>
        </div>
      ) : grouped ? (
        <div className="mt-10 space-y-10">
          {sections.map(({ category, items }) => (
            <section key={category.id} aria-labelledby={`cat-${category.id}`}>
              <h2 id={`cat-${category.id}`} className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                <span className={`h-2.5 w-2.5 rounded-full ${category.dot}`} aria-hidden="true" />
                {category.label}
                <span className="font-normal text-slate-400">{items.length}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {items.map((tool) => (
                  <li key={tool.slug}>
                    <ToolCard tool={tool} available={isAvailable(tool, caps)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((tool) => (
            <li key={tool.slug}>
              <ToolCard tool={tool} available={isAvailable(tool, caps)} />
            </li>
          ))}
        </ul>
      )}

      {filter === "todas" && normalized && normalizeSearch(`${READER_TOOL.title} ${READER_TOOL.keywords}`).includes(normalized) && (
        <div className="mt-8">
          <ReaderFeature />
        </div>
      )}
    </div>
  );
}
