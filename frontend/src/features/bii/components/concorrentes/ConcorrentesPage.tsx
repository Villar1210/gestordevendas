// Aba "Concorrentes" do BII (Fatia 3): lista dos concorrentes cadastrados pela
// empresa + painel de cadastro/edicao. Os mesmos concorrentes aparecem no mapa
// e na tabela da Analise por Endereco quando estao dentro do raio.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building, ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";
import { formatDataIso, formatNumero, formatPct } from "../../constants";
import { formatFaixaPreco, getFase, linkSeguro } from "../../constants-concorrentes";
import { formatPrecoM2 } from "../../constants-endereco";
import { listarConcorrentes, mensagemErroConcorrente } from "../../hooks/useBiiConcorrentesIntegration";
import type { Concorrente } from "../../types-concorrentes";
import { EmptyState } from "../EmptyState";
import { SourceBadge } from "../SourceBadge";
import { ConcorrenteForm } from "./ConcorrenteForm";

export function FaseBadge({ fase }: { fase: string }) {
  const f = getFase(fase);
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold ${f.classe}`}>{f.label}</span>
  );
}

export function DesatualizadoBadge() {
  return (
    <span
      title="Sem atualização há mais de 3 meses: preço de lançamento muda rápido. Confira e salve de novo."
      className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-px text-[11px] font-semibold text-amber-700"
    >
      mais de 3 meses
    </span>
  );
}

export function ConcorrentesPage() {
  const [itens, setItens] = useState<Concorrente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<{ concorrente: Concorrente | null; aviso?: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await listarConcorrentes());
    } catch (err) {
      setErro(mensagemErroConcorrente(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // ?id=<concorrente> (link "Ver concorrente" do mapa da analise): abre o
  // painel dele assim que a lista carrega. Lido do location (sem
  // useSearchParams, que exigiria Suspense na pagina estatica).
  const [idDaUrl] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id")));
  const [abriuDaUrl, setAbriuDaUrl] = useState(false);
  useEffect(() => {
    if (!idDaUrl || abriuDaUrl || !itens) return;
    setAbriuDaUrl(true);
    const c = itens.find((x) => x.id === idDaUrl);
    if (c) setAberto({ concorrente: c });
    else setErro("Esse concorrente não existe mais ou é de outra empresa.");
  }, [idDaUrl, abriuDaUrl, itens]);

  function aoSalvar(c: Concorrente, aviso?: string) {
    setItens((lista) => {
      const sem = (lista ?? []).filter((x) => x.id !== c.id);
      return [c, ...sem];
    });
    // continua aberto mostrando o pino (confirmar/ajustar a posicao)
    setAberto({ concorrente: c, aviso });
  }

  function aoExcluir(id: string) {
    setItens((lista) => (lista ?? []).filter((x) => x.id !== id));
    setAberto(null);
  }

  const lista = itens ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">Concorrentes</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Empreendimentos de outras construtoras que você acompanha. Os que estiverem dentro do raio aparecem no mapa e
            na tabela da <Link href="/dashboard/bii/endereco" className="text-blue-700 hover:underline">Análise por Endereço</Link>, ao lado do
            preço do ITBI.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            aria-label="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setAberto({ concorrente: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar concorrente
          </button>
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
        {carregando && itens === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Carregando concorrentes" />
          </div>
        ) : lista.length === 0 ? (
          <EmptyState
            icon={Building}
            titulo="Nenhum concorrente cadastrado ainda"
            texto="Cadastre os lançamentos que você visitou ou acompanha: nome, endereço, tipologias e preços. Eles passam a aparecer nas suas análises por endereço."
            acao={{ label: "Cadastrar o primeiro concorrente", onClick: () => setAberto({ concorrente: null }) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Empreendimento</th>
                  <th className="px-3 py-2.5 font-medium">Fase</th>
                  <th className="px-3 py-2.5 font-medium">Tipologias</th>
                  <th className="px-3 py-2.5 font-medium">Preço</th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      R$/m² mediano <SourceBadge fonte="Manual" />
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Vendido</th>
                  <th className="px-4 py-2.5 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => {
                  const link = linkSeguro(c.fonteUrl);
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer align-top hover:bg-slate-50"
                      onClick={() => setAberto({ concorrente: c })}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAberto({ concorrente: c });
                          }}
                          className="text-left font-semibold text-slate-800 hover:text-blue-700"
                        >
                          {c.nome}
                        </button>
                        <p className="text-xs text-slate-500">{[c.construtora, c.endereco].filter(Boolean).join(" · ")}</p>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                          >
                            fonte <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <FaseBadge fase={c.fase} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {c.tipologias.map((t) => t.descricao).join(", ")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatFaixaPreco(c)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">{formatPrecoM2(c.calculado.precoM2Mediano)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {c.calculado.percentualVendido !== null ? formatPct(c.calculado.percentualVendido) : "—"}
                        {c.calculado.vendasPorMes !== null && (
                          <span className="block text-xs text-slate-500">{formatNumero(Math.round(c.calculado.vendasPorMes))}/mês</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDataIso(c.atualizadoEm)}
                        {c.calculado.desatualizado && (
                          <span className="mt-1 block">
                            <DesatualizadoBadge />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {lista.length > 0 && (
        <p className="text-xs text-slate-500">
          Preços anunciados e área privativa, informados pela própria empresa. {formatNumero(lista.length)}{" "}
          {lista.length === 1 ? "concorrente cadastrado" : "concorrentes cadastrados"} (limite de 300).
        </p>
      )}

      {aberto && (
        <ConcorrenteForm
          concorrente={aberto.concorrente}
          aviso={aberto.aviso}
          onFechar={() => setAberto(null)}
          onSalvo={aoSalvar}
          onExcluido={aoExcluir}
        />
      )}
    </div>
  );
}
