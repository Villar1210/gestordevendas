// src/features/imoveis/components/book/BookAtalho.tsx
// Atalho "criar empreendimento a partir do book (PDF)" nos modais de cadastro.
import Link from "next/link";
import { FileUp } from "lucide-react";

export function BookAtalho({ onNavegar }: { onNavegar?: () => void }) {
  return (
    <Link
      href="/dashboard/imoveis/empreendimentos/book"
      onClick={onNavegar}
      className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 transition hover:border-blue-400 hover:bg-blue-100"
    >
      <FileUp className="mt-0.5 h-5 w-5 flex-none text-blue-700" aria-hidden />
      <span>
        <strong className="block font-semibold">Lançamento novo? Use o book (PDF)</strong>
        O sistema separa as páginas, lê a ficha técnica e salva as fotos de fachada, lazer e plantas.
      </span>
    </Link>
  );
}
