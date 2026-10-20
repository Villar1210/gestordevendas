// src/features/bii/components/ChartCard.tsx
// Card branco padrao das secoes do painel: titulo + selo de fonte + dica.
import { SourceBadge, type FonteDado } from "./SourceBadge";

interface ChartCardProps {
  titulo: string;
  fonte?: FonteDado;
  fonteDetalhe?: string;
  dica?: React.ReactNode;
  acoes?: React.ReactNode;
  rodape?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ titulo, fonte, fonteDetalhe, dica, acoes, rodape, children, className = "" }: ChartCardProps) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
          {titulo}
          <SourceBadge fonte={fonte} detalhe={fonteDetalhe} />
        </h2>
        {acoes}
      </div>
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      <div className="mt-4">{children}</div>
      {rodape && <p className="mt-3 text-xs text-slate-500">{rodape}</p>}
    </section>
  );
}
