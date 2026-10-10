// src/features/pdf_tools/components/SelectedFiles.tsx
// Lista/grade dos arquivos escolhidos: miniatura da 1a pagina (PDF) ou da
// imagem, nome, tamanho, paginas, remover e - em Juntar/Imagens - arrastar
// para reordenar.
"use client";

import { GripVertical, Lock, X } from "lucide-react";
import type { PdfTool } from "../catalog";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import type { SelectedFile } from "../types";
import { formatBytes } from "../lib/format";
import { PdfThumbnail } from "./pdf/dynamic";
import { SortableGrid } from "./SortableGrid";

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
  const isPdf = !item.previewUrl;

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300">
      <div className="relative flex aspect-[1/1.2] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        {isPdf ? (
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
