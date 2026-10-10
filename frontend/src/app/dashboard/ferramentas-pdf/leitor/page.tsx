// src/app/dashboard/ferramentas-pdf/leitor/page.tsx
// Leitor de PDF local: le o arquivo no navegador, nada e enviado ao servidor.
// Tambem abre o resultado de outra ferramenta (Blob entregue pela store).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { usePdfToolsStore } from "@/features/pdf_tools/store/usePdfToolsStore";
import { PdfReader } from "@/features/pdf_tools/components/pdf/dynamic";
import { fileExtension } from "@/features/pdf_tools/lib/format";

export default function LeitorPdfPage() {
  const [doc, setDoc] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consome o arquivo enviado por "Abrir no leitor" (uma vez).
  useEffect(() => {
    const source = usePdfToolsStore.getState().readerSource;
    if (source) {
      setDoc(source);
      usePdfToolsStore.getState().setReaderSource(null);
    }
  }, []);

  function open(file: File) {
    if (fileExtension(file.name) !== ".pdf" && file.type !== "application/pdf") {
      setError(`"${file.name}" não é um PDF.`);
      return;
    }
    setError(null);
    setDoc({ blob: file, name: file.name });
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-3 pb-6 pt-5 sm:px-6 lg:px-8">
      <nav aria-label="Trilha de navegação" className="text-sm">
        <ol className="flex items-center gap-1.5 text-slate-500">
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
            Leitor de PDF
          </li>
        </ol>
      </nav>
      <h1 className="sr-only">Leitor de PDF</h1>
      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <TriangleAlert className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          {error}
        </div>
      )}
      <div className="mt-4">
        <PdfReader file={doc?.blob ?? null} name={doc?.name ?? ""} onOpenFile={open} />
      </div>
    </div>
  );
}
