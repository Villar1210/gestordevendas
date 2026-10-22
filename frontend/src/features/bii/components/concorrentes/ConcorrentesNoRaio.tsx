// Card "Concorrentes no raio" da Analise por Endereco (Fatia 3): tabela dos
// concorrentes cadastrados pela empresa dentro do raio + R$/m2 mediano deles
// ao lado do mediano do ITBI (lado a lado, SEM "diferenca %": as bases sao
// diferentes - ver contrato).
"use client";

import Link from "next/link";
import { Building, Info } from "lucide-react";
import { formatMoeda, formatNumero, formatPct } from "../../constants";
import { formatFaixaPreco } from "../../constants-concorrentes";
import { formatDistancia, formatPrecoM2 } from "../../constants-endereco";
import type { ConcorrentesDaAnalise } from "../../types-concorrentes";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { SourceBadge } from "../SourceBadge";
import { DesatualizadoBadge, FaseBadge } from "./ConcorrentesPage";

interface Props {
  concorrentes: ConcorrentesDaAnalise | undefined;
  precoM2ItbiMediano: number | null;
  raioTexto: string;
  salva: boolean;
}

export function ConcorrentesNoRaio({ concorrentes, precoM2ItbiMediano, raioTexto, salva }: Props) {
  // analise salva antes da Fatia 3: nao tinha o campo
  if (!concorrentes) {
    return (
      <ChartCard titulo="Concorrentes no raio" fonte="Manual">
        <EmptyState compacto icon={Building} titulo="Esta análise foi salva antes do cadastro de concorrentes" texto="Faça uma nova análise do mesmo endereço para ver os concorrentes cadastrados." />
      </ChartCard>
    );
  }
  const { itens, resumo } = concorrentes;
  return (
    <ChartCard
      titulo={`Concorrentes no raio (${formatNumero(resumo.quantidade)})`}
      fonte="Manual"
      dica={`Empreendimentos que a sua empresa cadastrou em BII → Concorrentes, a até ${raioTexto} do endereço.`}
    >
      {itens.length === 0 ? (
        <EmptyState
          compacto
          icon={Building}
          titulo="Nenhum concorrente cadastrado neste raio"
          texto={salva ? "Na data desta análise não havia concorrentes cadastrados aqui." : "Cadastre os lançamentos da região para compará-los com o ITBI."}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                R$/m² mediano dos concorrentes <SourceBadge fonte="Manual" />
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{formatPrecoM2(resumo.precoM2Mediano)}</p>
              <p className="text-xs text-slate-500">preço anunciado ÷ área privativa</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                R$/m² mediano do ITBI <SourceBadge fonte="ITBI" />
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{formatPrecoM2(precoM2ItbiMediano)}</p>
              <p className="text-xs text-slate-500">valor pago ÷ área construída do IPTU</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Unidades dos concorrentes</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{resumo.unidadesTotais === null ? "—" : formatNumero(resumo.unidadesTotais)}</p>
              <p className="text-xs text-slate-500">soma dos que informaram o total</p>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Compare com cuidado: o ITBI usa o valor efetivamente pago e a área do IPTU (que inclui parte das áreas
              comuns); o concorrente usa preço de tabela e área privativa. Por isso o R$/m² anunciado costuma ficar acima
              do ITBI.
            </span>
          </p>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-2">Empreendimento</th>
                  <th className="px-2 py-2 font-medium">Distância</th>
                  <th className="px-2 py-2 font-medium">Fase</th>
                  <th className="px-2 py-2 font-medium">Preço</th>
                  <th className="px-2 py-2 font-medium">R$/m²</th>
                  <th className="px-2 py-2 font-medium">Unidades</th>
                  <th className="px-4 py-2 font-medium sm:px-2">Vendido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-2.5 sm:px-2">
                      <p className="font-medium text-slate-800">{c.nome}</p>
                      <p className="text-xs text-slate-500">{c.construtora ?? c.endereco}</p>
                      {c.calculado.desatualizado && (
                        <span className="mt-1 inline-block">
                          <DesatualizadoBadge />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{formatDistancia(c.distanciaMetros)}</td>
                    <td className="px-2 py-2.5">
                      <FaseBadge fase={c.fase} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{formatFaixaPreco(c)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-800">
                      {formatPrecoM2(c.calculado.precoM2Mediano)}
                      {c.calculado.precoM2Min !== null && c.calculado.precoM2Max !== null && c.calculado.precoM2Min !== c.calculado.precoM2Max && (
                        <span className="block text-xs font-normal text-slate-500">
                          {formatMoeda(c.calculado.precoM2Min)} – {formatMoeda(c.calculado.precoM2Max)}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{c.totalUnidades === null ? "—" : formatNumero(c.totalUnidades)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700 sm:px-2">
                      {c.calculado.percentualVendido === null ? "—" : formatPct(c.calculado.percentualVendido)}
                      {c.calculado.vendasPorMes !== null && (
                        <span className="block text-xs text-slate-500">{formatNumero(Math.round(c.calculado.vendasPorMes))}/mês</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!salva && (
            <p className="text-xs text-slate-500">
              Para incluir ou corrigir um concorrente, use a aba{" "}
              <Link href="/dashboard/bii/concorrentes" className="text-blue-700 hover:underline">
                Concorrentes
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}
