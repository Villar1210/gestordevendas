// src/features/pdf_tools/components/pdf/dynamic.tsx
// Pontos de entrada client-only de tudo que usa react-pdf/pdfjs.
// ssr:false e obrigatorio - ver comentario em features/edoc/components/PdfViewer.tsx.
"use client";

import dynamic from "next/dynamic";

function ThumbSkeleton() {
  return <div className="aspect-[1/1.414] w-full animate-pulse bg-slate-100" />;
}

function PanelSkeleton() {
  return <div className="h-80 w-full animate-pulse rounded-2xl bg-slate-100" />;
}

export const PdfThumbnail = dynamic(() => import("./PdfThumbnail").then((m) => m.PdfThumbnail), {
  ssr: false,
  loading: ThumbSkeleton,
});

export const OrganizePagesGrid = dynamic(
  () => import("./OrganizePagesGrid").then((m) => m.OrganizePagesGrid),
  { ssr: false, loading: PanelSkeleton },
);

export const PdfPreview = dynamic(() => import("./PdfPreview").then((m) => m.PdfPreview), {
  ssr: false,
  loading: PanelSkeleton,
});

export const PdfReader =dynamic(() => import("./PdfReader").then((m) => m.PdfReader), {
  ssr: false,
  loading: PanelSkeleton,
});
