// src/app/site/[site]/not-found.tsx
import Link from "next/link";

export default function SiteNaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Página não encontrada</h1>
      <p className="mt-2 text-slate-600">Este imóvel pode ter sido vendido ou retirado do site.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
        Voltar ao início
      </Link>
    </div>
  );
}
