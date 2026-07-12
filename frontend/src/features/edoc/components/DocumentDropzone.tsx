// src/features/edoc/components/DocumentDropzone.tsx
// Fatia 4: substitui o botao simples de upload por uma dropzone
// (arrastar-e-soltar OU clicar), aceitando PDF/DOC/DOCX/XLS/XLSX.
"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  ACCEPTED_DOCUMENT_MIMETYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "../constants";

interface DocumentDropzoneProps {
  file: File | null;
  // true quando estamos editando um rascunho que ja tem um documento salvo
  // e o usuario ainda nao escolheu um arquivo novo para substitui-lo.
  hasExistingDocument?: boolean;
  onFileSelected: (file: File) => void;
}

export function DocumentDropzone({
  file,
  hasExistingDocument,
  onFileSelected,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function validateAndSelect(selected: File | undefined) {
    if (!selected) return;
    const extension = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    const isAccepted =
      ACCEPTED_DOCUMENT_EXTENSIONS.includes(extension) ||
      ACCEPTED_DOCUMENT_MIMETYPES.includes(selected.type);
    if (!isAccepted) {
      alert("Formato nao suportado. Envie um arquivo PDF, Word (.doc/.docx) ou Excel (.xls/.xlsx).");
      return;
    }
    if (selected.size > MAX_DOCUMENT_SIZE_BYTES) {
      alert("O arquivo excede o tamanho maximo de 30MB.");
      return;
    }
    onFileSelected(selected);
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-slate-500">Documento</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          validateAndSelect(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-3 py-6 text-center transition ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400"
        }`}
      >
        <UploadCloud className="h-6 w-6 text-slate-400" />
        {file ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <FileText className="h-4 w-4 shrink-0" /> {file.name}
          </span>
        ) : hasExistingDocument ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <FileText className="h-4 w-4 shrink-0" /> Documento atual (clique para trocar)
          </span>
        ) : (
          <span className="text-sm text-slate-500">Arraste o arquivo aqui ou clique para escolher</span>
        )}
        <span className="text-xs text-slate-400">
          PDF, Word (.doc/.docx) ou Excel (.xls/.xlsx), ate 30MB. Arquivos Word e Excel sao
          convertidos automaticamente para PDF.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => validateAndSelect(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
