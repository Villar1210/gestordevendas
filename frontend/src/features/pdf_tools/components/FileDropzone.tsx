// src/features/pdf_tools/components/FileDropzone.tsx
// Dropzone acessivel: e um <button> de verdade (Enter/Espaco abrem o seletor),
// aceita arrastar-e-soltar e tem a variante compacta "+ adicionar mais".
"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { Plus, Upload } from "lucide-react";
import type { PdfTool } from "../catalog";
import { getCategory } from "../catalog";
import { PaperSheet } from "./PaperSheet";

interface FileDropzoneProps {
  tool: PdfTool;
  onFiles: (files: File[]) => void;
  variant?: "hero" | "compact";
  disabled?: boolean;
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function FileDropzone({ tool, onFiles, variant = "hero", disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const category = getCategory(tool.category);
  const Icon = tool.icon;

  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e) || disabled) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e) || disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const dropped = Array.from(e.dataTransfer.files ?? []);
      if (dropped.length) onFiles(dropped);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={tool.accept}
      multiple={tool.multiple}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (picked.length) onFiles(picked);
      }}
    />
  );

  const limitText = tool.multiple
    ? `${tool.acceptLabel} · até ${tool.maxFiles} arquivos · 50 MB cada`
    : `${tool.acceptLabel} · até 50 MB`;

  if (variant === "compact") {
    return (
      <div {...dragHandlers}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
            dragging
              ? `${category.accentBorder} ${category.accentSoft} ${category.accentText}`
              : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-white hover:text-slate-900"
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar mais arquivos
        </button>
        {input}
      </div>
    );
  }

  return (
    <div {...dragHandlers}>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        className={`group flex w-full flex-col items-center gap-6 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:py-20 ${
          dragging
            ? `${category.accentBorder} ${category.accentSoft}`
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <div className={`transition motion-reduce:transition-none ${dragging ? "-translate-y-1 scale-105" : "group-hover:-translate-y-0.5"}`}>
          <PaperSheet tone={category.tile} size="lg" stacked={tool.multiple}>
            <Icon className="h-10 w-10" strokeWidth={1.5} />
          </PaperSheet>
        </div>
        <div>
          <span className="block text-lg font-semibold text-slate-900">
            {dragging
              ? "Solte para adicionar"
              : tool.dropzoneTitle ?? (tool.multiple ? "Arraste os arquivos aqui" : "Arraste o arquivo aqui")}
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            ou{" "}
            <span className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 group-hover:decoration-blue-700">
              clique para selecionar
            </span>
          </span>
        </div>
        <span
          id={hintId}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {limitText}
        </span>
      </button>
      {input}
    </div>
  );
}
