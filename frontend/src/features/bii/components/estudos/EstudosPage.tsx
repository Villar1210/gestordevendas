// Aba "Estudos" do BII (Fatia 5): lista dos estudos de terreno salvos e o
// assistente de "Novo estudo". ?novo=1&analise=<id> abre o assistente ja com
// a analise escolhida (botao na Analise por Endereco).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight, FileText, Loader2, Plus } from "lucide-react";
import { formatDataIso } from "../../constants";
import { formatRaio } from "../../constants-endereco";
import { listarEstudos, mensagemErroEstudo } from "../../hooks/useBiiEstudosIntegration";
import type { EstudoListaItem } from "../../types-estudo";
import { EmptyState } from "../EmptyState";
import { Pill, SITUACAO } from "../viabilidade/ViabilidadePage";
import { NovoEstudo } from "./NovoEstudo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function EstudosPage() {
  const router = useRouter();
  const busca = useSearchParams();
  const analiseParam = busca?.get("analise") ?? null;
  const [novo, setNovo] = useState(busca?.get("novo") === "1");
  const [itens, setItens] = useState<EstudoListaItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setErro(null);
    listarEstudos()
      .then(setItens)
      .catch((err) => setErro(mensagemErroEstudo(err)));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-4">
      {novo ? (
        <NovoEstudo analiseInicial={analiseParam && UUID.test(analiseParam) ? analiseParam : null} onCancelar={() => {
            setNovo(false);
            // tira ?novo=1&analise=... da URL (reload nao reabre o assistente)
            if (busca?.get("novo") || busca?.get("analise")) router.replace("/dashboard/bii/estudos");
          }}
        />
      ) : null}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">Estudos de terreno</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              Relatório que junta o mercado do endereço (ITBI), os concorrentes no raio e a viabilidade HIS/HMP/MCMV das
              tipologias — salvo como foto do dia, para imprimir ou levar à diretoria.
            </p>
          </div>
          {!novo && (
            <button
              type="button"
              onClick={() => setNovo(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Novo estudo
            </button>
          )}
        </div>

        <div className="mt-4">
          {erro ? (
            <EmptyState icon={AlertCircle} titulo="Não foi possível carregar os estudos" texto={erro} acao={{ label: "Tentar de novo", onClick: carregar }} />
          ) : itens === null ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> Carregando estudos...
            </div>
          ) : itens.length === 0 ? (
            <EmptyState icon={FileText} titulo="Nenhum estudo salvo ainda" texto="Clique em Novo estudo: escolha uma análise de mercado, informe as tipologias e salve." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {itens.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/bii/estudos/${e.id}`)}
                    className="flex w-full min-w-0 items-center gap-3 px-1 py-3 text-left hover:bg-slate-50"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-slate-800">{e.nome}</span>
                      <span className="block break-words text-xs text-slate-500">
                        {e.endereco} · raio {formatRaio(e.raioMetros)} · atualizado em {formatDataIso(e.atualizadoEm)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {(["ok", "atencao", "fora"] as const)
                          .filter((s) => e.situacao[s] > 0)
                          .map((s) => (
                            <Pill key={s} classe={SITUACAO[s].classe}>
                              {e.situacao[s]} {SITUACAO[s].label.toLowerCase()}
                            </Pill>
                          ))}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
