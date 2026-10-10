// src/features/pdf_tools/components/SelectedFiles.tsx
// Lista/grade dos arquivos escolhidos: miniatura da 1a pagina (PDF), da
// imagem ou icone por tipo (Office), nome, tamanho, paginas, remover e - em
// Juntar/Imagens - arrastar para reordenar. Com varios arquivos, uma nota
// "N arquivos · tamanho total" no topo.
"use client";

import { FileSpreadsheet, FileText, GripVertical, Lock, Presentation, X, type LucideIcon } from "lucide-react";
import type { PdfTool } from "../catalog";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import type { SelectedFile } from "../types";
import { fileExtension, formatBytes } from "../lib/format";
import { PdfThumbnail } from "./pdf/dynamic";
import { SortableGrid } from "./SortableGrid";

// Office nao tem miniatura no navegador: icone + extensao por tipo.
const OFFICE_KINDS: { exts: string[]; icon: LucideIcon; tone: string }[] = [
  { exts: [".doc", ".docx", ".odt"], icon: FileText, tone: "bg-blue-50 text-blue-700" },
  { exts: [".xls", ".xlsx", ".ods"], icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-700" },
  { exts: [".ppt", ".pptx", ".odp"], icon: Presentation, tone: "bg-orange-50 text-orange-700" },
];

function officeKind(name: string) {
  const ext = fileExtension(name);
  return OFFICE_KINDS.find((k) => k.exts.includes(ext)) ?? null;
}

function OfficeIcon({ name }: { name: string }) {
  const kind = officeKind(name) ?? OFFICE_KINDS[0];
  const Icon = kind.icon;
  return (
    <div className={`flex h-[70%] w-[62%] flex-col items-center justify-center gap-2 rounded-lg shadow-md shadow-slate-300/60 ${kind.tone}`}>
      <Icon className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
      <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {fileExtension(name).slice(1)}
      </span>
    </div>
  );
}

function FileCard({
  item,
  position,
  reorderable,
  onRemove,
}: {
  item: SelectedFile;
  position: number;
  reorderable: boolean;
  onRemove: () => void;
}) {
  const updateFileInfo = usePdfToolsStore((s) => s.updateFileInfo);
  const isOffice = !item.previewUrl && officeKind(item.file.name) !== null;
  const isPdf = !item.previewUrl && !isOffice;

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300">
      <div className="relative flex aspect-[1/1.2] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        {isOffice ? (
          <OfficeIcon name={item.file.name} />
        ) : isPdf ? (
          <div className="shadow-md shadow-slate-300/60">
            <PdfThumbnail
              file={item.file}
              width={120}
              onLoaded={(pages) => updateFileInfo(item.id, { pages, locked: false })}
              onLocked={() => updateFileInfo(item.id, { locked: true })}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-contain p-2" />
        )}
        {reorderable && (
          <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900/85 px-1.5 text-xs font-semibold text-white">
            {position}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${item.file.name}`}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2.5 flex items-start gap-1.5 px-0.5">
        {reorderable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatBytes(item.file.size)}
            {item.pages ? ` · ${item.pages} ${item.pages === 1 ? "página" : "páginas"}` : ""}
          </p>
          {item.locked && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600">
              <Lock className="h-3 w-3" aria-hidden="true" /> Com senha
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FilesSummary({ tool }: { tool: PdfTool }) {
  const files = usePdfToolsStore((s) => s.files);
  if (!tool.multiple || files.length < 2) return null;
  const total = files.reduce((sum, f) => sum + f.file.size, 0);
  return (
    <p className="text-sm text-slate-500" aria-live="polite">
      <span className="font-semibold text-slate-800">{files.length} arquivos</span> · {formatBytes(total)} no total
      {tool.batch && <span className="text-slate-400"> · cada um é processado separadamente</span>}
    </p>
  );
}

export function SelectedFiles({ tool }: { tool: PdfTool }) {
  const files = usePdfToolsStore((s) => s.files);
  const removeFile = usePdfToolsStore((s) => s.removeFile);
  const reorderFiles = usePdfToolsStore((s) => s.reorderFiles);

  if (tool.reorderable && files.length > 1) {
    return (
      <SortableGrid
        idPrefix="arquivos"
        items={files}
        getKey={(f) => f.id}
        getLabel={(f, i) => `${f.file.name}, posição ${i + 1} de ${files.length}. Pressione espaço para mover.`}
        minItemWidth={150}
        onReorder={reorderFiles}
        renderItem={(item, index) => (
          <FileCard item={item} position={index + 1} reorderable onRemove={() => removeFile(item.id)} />
        )}
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {files.map((item, index) => (
        <li key={item.id} className={files.length === 1 ? "col-span-1" : undefined}>
          <FileCard item={item} position={index + 1} reorderable={false} onRemove={() => removeFile(item.id)} />
        </li>
      ))}
    </ul>
  );
}
