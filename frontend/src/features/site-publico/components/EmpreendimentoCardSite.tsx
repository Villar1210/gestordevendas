// src/features/site-publico/components/EmpreendimentoCardSite.tsx
import Link from "next/link";
import { Building2 } from "lucide-react";
import type { EmpreendimentoResumo } from "../types";
import { STATUS_OBRA, formatarPreco, localizacao, urlFoto } from "../format";

export function EmpreendimentoCardSite({ emp, base }: { emp: EmpreendimentoResumo; base: string }) {
  const foto = urlFoto(emp.fotoCapa);
  const aPartir = formatarPreco(emp.precoMinimo);
  return (
    <Link
      href={`${base}/empreendimento/${emp.id}`}
      className="group relative flex h-64 overflow-hidden rounded-2xl bg-slate-800 shadow-sm transition hover:shadow-lg"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt={emp.nome} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
          <Building2 className="h-16 w-16" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent" />
      <div className="relative mt-auto p-5 text-white">
        {emp.statusObra && (
          <span className="mb-2 inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium">
            {STATUS_OBRA[emp.statusObra] ?? emp.statusObra}
          </span>
        )}
        <h3 className="text-xl font-bold">{emp.nome}</h3>
        <p className="text-sm text-slate-200">{localizacao(emp.bairro, emp.cidade, emp.uf)}</p>
        {aPartir && <p className="mt-1 text-sm">A partir de <strong>{aPartir}</strong></p>}
      </div>
    </Link>
  );
}
