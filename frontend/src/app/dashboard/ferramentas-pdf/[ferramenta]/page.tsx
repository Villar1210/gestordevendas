// src/app/dashboard/ferramentas-pdf/[ferramenta]/page.tsx
// Area de trabalho generica: a ferramenta vem do slug da URL e o catalogo
// define dropzone, painel de opcoes e endpoint.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getToolBySlug } from "@/features/pdf_tools/catalog";
import { ToolWorkspace } from "@/features/pdf_tools/components/ToolWorkspace";

export default function FerramentaPdfPage() {
  const params = useParams<{ ferramenta: string }>();
  const tool = getToolBySlug(params?.ferramenta ?? "");

  if (!tool || tool.kind === "reader") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Ferramenta não encontrada</h1>
        <p className="mt-2 text-slate-500">O endereço pode estar incorreto ou a ferramenta mudou de nome.</p>
        <Link
          href="/dashboard/ferramentas-pdf"
          className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        >
          Ver todas as ferramentas
        </Link>
      </div>
    );
  }

  return <ToolWorkspace key={tool.slug} tool={tool} />;
}
