// Card "Base do GeoSampa" da tela do Super Usuario (Fatia 6): baixa as
// quadras e lotes fiscais do GeoSampa (Prefeitura de SP) e localiza as guias
// do ITBI pelo SQL do imovel - sem depender do endereco digitado. Mostra
// quantas guias ja tem local e com que precisao. Polling de 10 s so enquanto
// o job roda (a cobertura conta a tabela inteira do ITBI).
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Map as MapIcon, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import type { GeoSampaResumo, ModoGeoSampa, ProgressoGeoSampa } from "../types";

const POLLING_MS = 10_000;
const numero = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const fmt = (v: number | null | undefined) => (typeof v === "number" ? numero.format(v) : "—");
function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : dataHora.format(d);
}
function pct(parte: number, total: number) {
  if (!total) return "—";
  return `${(Math.round((parte / total) * 1000) / 10).toLocaleString("pt-BR")}%`;
}

const ETAPA: Record<ProgressoGeoSampa["etapa"], string> = {
  quadras: "Baixando quadras",
  lotes: "Baixando lotes",
  localizando: "Localizando as guias do ITBI",
};

function mensagemErro(err: unknown): string {
  if (!(err instanceof ApiError)) return "Não foi possível falar com o servidor. Verifique sua conexão.";
  if (err.status === 409) return err.message || "Já existe uma atualização do GeoSampa em andamento.";
  if (err.status === 429) return "Limite atingido (6 por hora). Tente mais tarde.";
  if (err.status === 400) return err.message;
  return "Não foi possível concluir agora. Tente de novo.";
}

function Barra({ valor, total }: { valor: number; total: number }) {
  const p = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export function GeoSampaBaseCard() {
  const [dados, setDados] = useState<GeoSampaResumo | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<ModoGeoSampa | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiRequest<GeoSampaResumo>("/bii-plataforma/itbi/geosampa");
      setDados(r && typeof r === "object" && "base" in r ? r : null);
      setErroCarregar(null);
    } catch (err) {
      setErroCarregar(mensagemErro(err));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atual = dados?.atual ?? null;
  const rodando = atual?.status === "processando";

  useEffect(() => {
    if (!rodando) return;
    const t = window.setInterval(carregar, POLLING_MS);
    return () => window.clearInterval(t);
  }, [rodando, carregar]);

  async function iniciar(modo: ModoGeoSampa) {
    setErroAcao(null);
    setEnviando(modo);
    try {
      await apiRequest("/bii-plataforma/itbi/geosampa", { method: "POST", body: JSON.stringify({ modo }) });
      await carregar();
    } catch (err) {
      setErroAcao(mensagemErro(err));
    } finally {
      setEnviando(null);
    }
  }

  const base = dados?.base;
  const cob = dados?.cobertura;
  const temBase = (base?.quadras ?? 0) > 0;

  return (
    <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
          <MapIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800">Base do GeoSampa — localização pelo SQL</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Quadras e lotes fiscais da Prefeitura. Cada guia do ITBI é posicionada pelo SQL do imóvel: casas e terrenos no
            lote exato, apartamentos no centro da quadra. Vale para a cidade inteira, sem gastar consultas de endereço.
          </p>
        </div>
      </div>

      {erroCarregar && (
        <p className="mt-4 flex items-center gap-2 text-sm text-red-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {erroCarregar}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Base baixada</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Quadras</dt>
              <dd className="font-semibold text-slate-800">{fmt(base?.quadras)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lotes</dt>
              <dd className="font-semibold text-slate-800">{fmt(base?.lotes)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Atualizada em</dt>
              <dd className="text-slate-800">{fmtData(base?.atualizadoEm)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BOTAO} disabled={rodando || enviando !== null} onClick={() => iniciar("atualizar")}>
              {enviando === "atualizar" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              {temBase ? "Atualizar base do GeoSampa" : "Baixar base do GeoSampa"}
            </button>
            <button
              type="button"
              className={BOTAO_SECUNDARIO}
              disabled={!temBase || rodando || enviando !== null}
              onClick={() => iniciar("localizar")}
              title={temBase ? undefined : "Baixe a base primeiro"}
            >
              {enviando === "localizar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Só localizar as guias
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Baixar a base leva de 20 a 60 minutos (1,7 milhão de lotes). Importações novas do ITBI são localizadas sozinhas.
          </p>
          {erroAcao && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-700" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {erroAcao}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Guias do ITBI com localização</h3>
          {cob ? (
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { rotulo: "No lote exato (SQL)", v: cob.lote, cor: "bg-green-600" },
                { rotulo: "Na quadra (SQL)", v: cob.quadra, cor: "bg-blue-600" },
                { rotulo: "Pelo endereço (OpenStreetMap)", v: cob.endereco, cor: "bg-slate-400" },
                { rotulo: "Sem localização", v: cob.semLocal, cor: "bg-slate-200" },
              ].map((l) => (
                <li key={l.rotulo} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.cor}`} aria-hidden="true" />
                    <span className="truncate">{l.rotulo}</span>
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-800">
                    {fmt(l.v)} <span className="text-xs font-normal text-slate-500">({pct(l.v, cob.total)})</span>
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-2 text-slate-500">
                <span>Total de guias</span>
                <span className="font-medium text-slate-800">{fmt(cob.total)}</span>
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{erroCarregar ? "—" : "Carregando..."}</p>
          )}
        </div>
      </div>

      {atual && (
        <div className="mt-6 rounded-xl border border-slate-200 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">
              {atual.modo === "atualizar" ? "Última atualização da base" : "Última localização"}
            </h3>
            <span className="text-xs text-slate-500">
              Início {fmtData(atual.iniciadoEm)}
              {atual.concluidoEm ? ` · fim ${fmtData(atual.concluidoEm)}` : ""}
            </span>
          </div>
          {rodando ? (
            <div className="mt-3 space-y-2">
              <p className="flex items-center gap-2 text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
                {ETAPA[atual.etapa]}…
              </p>
              {atual.etapa === "quadras" && <Barra valor={atual.quadras.lidas} total={atual.quadras.total} />}
              {atual.etapa === "lotes" && <Barra valor={atual.lotes.lidos} total={atual.lotes.total} />}
              {atual.etapa === "localizando" && <Barra valor={atual.localizacao.setoresFeitos} total={atual.localizacao.setores} />}
            </div>
          ) : atual.status === "concluida" ? (
            <p className="mt-2 text-green-700">Concluída.</p>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-red-700" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {atual.mensagemErro ?? "Não terminou."}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Quadras lidas</dt>
              <dd className="text-slate-800">
                {fmt(atual.quadras.lidas)} / {fmt(atual.quadras.total)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Lotes lidos</dt>
              <dd className="text-slate-800">
                {fmt(atual.lotes.lidos)} / {fmt(atual.lotes.total)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Guias no lote</dt>
              <dd className="text-slate-800">{fmt(atual.localizacao.porLote)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Guias na quadra</dt>
              <dd className="text-slate-800">{fmt(atual.localizacao.porQuadra)}</dd>
            </div>
          </dl>
        </div>
      )}

      {dados?.atribuicao && <p className="mt-4 text-xs text-slate-400">{dados.atribuicao}</p>}
    </section>
  );
}
