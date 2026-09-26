// src/features/site-publico/components/Paginacao.tsx
import Link from "next/link";

export function Paginacao({ page, total, pageSize, hrefPara }: { page: number; total: number; pageSize: number; hrefPara: (p: number) => string }) {
  const paginas = Math.ceil(total / pageSize);
  if (paginas <= 1) return null;
  const botao = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 && <Link href={hrefPara(page - 1)} className={botao}>Anterior</Link>}
      <span className="text-sm text-slate-500">Página {page} de {paginas}</span>
      {page < paginas && <Link href={hrefPara(page + 1)} className={botao}>Próxima</Link>}
    </nav>
  );
}
