// src/features/pdf_tools/components/CreatePdfEditor.tsx
// "Criar PDF": editor de texto com sintaxe minima (# titulo, ## subtitulo,
// - item). O PDF e gerado no servidor (POST /pdf-tools/create, JSON).
"use client";

import { useId } from "react";
import { RadioCards, TextField, useOption } from "./options/controls";

const MAX_CHARS = 50_000;

const SYNTAX: { code: string; label: string }[] = [
  { code: "# ", label: "Título" },
  { code: "## ", label: "Subtítulo" },
  { code: "- ", label: "Item de lista" },
];

export function CreatePdfEditorBody() {
  const [title, setTitle] = useOption<string>("title", "");
  const [content, setContent] = useOption<string>("content", "");
  const fontSize = Number(useOption<number>("fontSize", 12)[0]);
  const id = useId();

  return (
    <div className="flex h-full flex-col gap-4">
      <TextField
        label="Título do documento (opcional)"
        value={title}
        onChange={setTitle}
        placeholder="Ex.: Proposta comercial — Residencial Jardins"
        maxLength={120}
        hint="Aparece no cabeçalho de todas as páginas."
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <label htmlFor={id} className="text-sm font-semibold text-slate-800">
            Conteúdo
          </label>
          <span className={`text-xs ${content.length > MAX_CHARS ? "text-rose-600" : "text-slate-400"}`}>
            {content.length.toLocaleString("pt-BR")} / 50.000
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
          <div id={`${id}-hint`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Formatação:</span>
            {SYNTAX.map((s) => (
              <span key={s.code} className="inline-flex items-center gap-1.5">
                <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                  {s.code.trim()}
                </code>
                {s.label}
              </span>
            ))}
            <span>Linha em branco = novo parágrafo</span>
          </div>
          <textarea
            id={id}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-describedby={`${id}-hint`}
            spellCheck
            placeholder={"# Proposta comercial\n\nPrezado cliente,\n\nSegue a proposta para a unidade 402.\n\n## Condições\n- Entrada de 10%\n- Saldo em 120 meses"}
            className="min-h-[22rem] flex-1 resize-y bg-white px-4 py-4 leading-relaxed text-slate-900 placeholder:text-slate-300 focus:outline-none lg:min-h-[28rem]"
            style={{ fontSize: Math.max(13, Math.min(16, fontSize + 2)) }}
          />
        </div>
      </div>
    </div>
  );
}

export function CreatePdfOptions() {
  const [pageSize, setPageSize] = useOption<string>("pageSize", "A4");
  const [fontSize, setFontSize] = useOption<number>("fontSize", 12);
  return (
    <>
      <RadioCards
        name="create-size"
        legend="Tamanho da página"
        columns={2}
        value={pageSize}
        onChange={setPageSize}
        options={[
          { value: "A4", label: "A4", description: "21 × 29,7 cm" },
          { value: "Carta", label: "Carta", description: "21,6 × 27,9 cm" },
        ]}
      />
      <div>
        <label htmlFor="create-font" className="mb-1.5 flex justify-between text-sm font-semibold text-slate-800">
          Tamanho da fonte <span className="font-normal text-slate-500">{fontSize} pt</span>
        </label>
        <input
          id="create-font"
          type="range"
          min={10}
          max={16}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-blue-700"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400" aria-hidden="true">
          <span>10</span>
          <span>16</span>
        </div>
      </div>
      <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-500">
        O PDF ganha cabeçalho com o título, rodapé “Página n de N” e quebra de página automática.
      </p>
    </>
  );
}
