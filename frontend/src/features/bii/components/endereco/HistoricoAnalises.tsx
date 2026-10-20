// Aba "Historico" do BII: ultimas analises por endereco do tenant
// (GET /bii/analises). Abrir mostra a analise como foi salva.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, History, Loader2 } from "lucide-react";
import { formatDataIso, formatNumero } from "../../constants";
import { formatPrecoM2, formatRaio } from "../../constants-endereco";
import { listarAnalises, mensagemErroAnalise } from "../../hooks/useBiiAnaliseIntegration";
import type { AnaliseResumoItem } from "../../types-endereco";
import { EmptyState } from "../EmptyState";
import { SourceBadge } from "../SourceBadge";

export function HistoricoAnalises() {
  const router = useRouter();
  const [itens, setItens] = useState<AnaliseResumoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    listarAnalises()
      .then(setItens)
      .catch((err) => setErro(mensagemErroAnalise(err)))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
            Análises salvas
            <SourceBadge fonte="ITBI" />
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cada análise guarda os números do dia em que foi feita (foto do momento). Últimas 50.
          </p>
        </div>
        <Link
          href="/dashboard/bii/endereco"
          className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          Nova análise
        </Link>
      </div>

      <div className="mt-4">
        {carregando && !itens ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
            Carregando histórico...
          </div>
        ) : erro ? (
          <EmptyState
            icon={AlertCircle}
            titulo="Não foi possível carregar o histórico"
            texto={erro}
            acao={{ label: "Tentar de novo", onClick: carregar }}
          />
        ) : !itens || itens.length === 0 ? (
          <EmptyState
            icon={History}
            titulo="Você ainda não fez nenhuma análise"
            texto="Faça uma análise por endereço: ela fica salva aqui para você comparar o mesmo terreno ao longo do tempo."
            acao={{ label: "Nova análise por endereço", onClick: () => router.push("/dashboard/bii/endereco") }}
          />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Data</th>
                  <th scope="col" className="px-4 py-2 font-medium">Endereço</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Raio</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Período</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Transações</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">R$/m² mediano</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/dashboard/bii/historico/${encodeURIComponent(a.id)}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDataIso(a.criadoEm)}</td>
                    <td className="max-w-[320px] px-4 py-2.5 font-medium text-slate-800">
                      <span className="line-clamp-2 break-words">{a.enderecoFormatado || a.endereco}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-600">{formatRaio(a.raioMetros)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-600">{a.meses} meses</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-800">{formatNumero(a.transacoes)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-blue-700">
                      {formatPrecoM2(a.precoM2Mediano)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Link
                        href={`/dashboard/bii/historico/${encodeURIComponent(a.id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700"
                      >
                        Abrir
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
