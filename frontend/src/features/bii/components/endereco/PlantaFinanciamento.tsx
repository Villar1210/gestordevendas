// Cards da Analise por Endereco ligados ao mercado HIS/MCMV:
// - PlantaCard: vendas sem area construida no IPTU (em geral unidades novas
//   na planta, cujo cadastro ainda e o do terreno) - em destaque.
// - FinanciamentoCard: como as vendas do raio foram pagas (barra empilhada).
import { Building2 } from "lucide-react";
import { formatMoeda, formatNumero } from "../../constants";
import { FINANCIAMENTO_ROTULOS } from "../../constants-endereco";
import type { AnaliseEnderecoResponse } from "../../types-endereco";
import { ChartCard } from "../ChartCard";
import { SourceBadge } from "../SourceBadge";

function pct(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

export function PlantaCard({
  planta,
  fonteDetalhe,
}: {
  planta: AnaliseEnderecoResponse["planta"];
  fonteDetalhe?: string;
}) {
  return (
    <section className="h-full min-w-0 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-start gap-2 text-sm font-semibold text-slate-800">
          <Building2 className="mt-px h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          Unidades vendidas na planta (sem área no IPTU)
        </h2>
        <SourceBadge fonte="ITBI" detalhe={fonteDetalhe} />
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Em geral unidades novas cujo cadastro na Prefeitura ainda é o do terreno — por isso não têm R$/m² e ficam fora
        da mediana de preço por m².
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
        <div className="min-w-0 rounded-xl bg-white p-3">
          <dt className="text-xs text-slate-500">Unidades vendidas</dt>
          <dd className="mt-1 truncate text-2xl font-semibold text-blue-700">{formatNumero(planta.transacoes)}</dd>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-3">
          <dt className="text-xs text-slate-500">Valor mediano</dt>
          <dd
            className="mt-1 truncate text-2xl font-semibold text-blue-700"
            title={planta.valorMediano === null ? undefined : formatMoeda(planta.valorMediano)}
          >
            {planta.valorMediano === null ? "—" : formatMoeda(planta.valorMediano)}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-3">
          <dt className="text-xs text-slate-500">Com Minha Casa Minha Vida</dt>
          <dd className="mt-1 truncate text-2xl font-semibold text-blue-700">
            {formatNumero(planta.comMcmv)}
            <span className="ml-1.5 text-sm font-medium text-slate-500">{pct(planta.comMcmv, planta.transacoes)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function FinanciamentoCard({
  financiamento,
  fonteDetalhe,
}: {
  financiamento: AnaliseEnderecoResponse["financiamento"];
  fonteDetalhe?: string;
}) {
  const total = FINANCIAMENTO_ROTULOS.reduce((soma, r) => soma + (financiamento[r.id] ?? 0), 0);
  const resumo = FINANCIAMENTO_ROTULOS.map((r) => `${r.label}: ${financiamento[r.id] ?? 0}`).join("; ");
  return (
    <ChartCard
      className="h-full"
      titulo="Como as vendas foram pagas"
      fonte="ITBI"
      fonteDetalhe={fonteDetalhe}
      dica="Tipo de financiamento declarado na guia de ITBI, no raio e no período."
    >
      {total === 0 ? (
        <p className="py-4 text-sm text-slate-500">Sem transações no período.</p>
      ) : (
        <>
          <div
            className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`Financiamento das vendas. ${resumo}`}
          >
            {FINANCIAMENTO_ROTULOS.map((r) => {
              const v = financiamento[r.id] ?? 0;
              return v > 0 ? (
                <div key={r.id} style={{ width: `${(v / total) * 100}%`, backgroundColor: r.cor }} title={`${r.label}: ${v}`} />
              ) : null;
            })}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-y-2">
            {FINANCIAMENTO_ROTULOS.map((r) => (
              <li key={r.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border border-slate-300/60"
                  style={{ backgroundColor: r.cor }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-slate-600" title={r.label}>
                  {r.label}
                </span>
                <span className="font-semibold text-slate-800">{formatNumero(financiamento[r.id] ?? 0)}</span>
                <span className="w-9 text-right text-xs text-slate-500">{pct(financiamento[r.id] ?? 0, total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
