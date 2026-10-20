// src/features/bii/components/PainelFiltros.tsx
// Filtros do Painel de Vendas: periodo (presets ou datas), pipeline,
// corretor e origem. So consulta o backend ao clicar em "Aplicar".
"use client";

import { useState } from "react";
import { FILTROS_PADRAO, PERIODO_PRESETS, formatDateOnly, getOrigemLabel, periodoDoPreset, validarPeriodo } from "../constants";
import { useBiiPainelStore } from "../store/useBiiPainelStore";
import type { PainelFiltrosState, PeriodoPreset } from "../types";
import { SourceBadge } from "./SourceBadge";

interface PainelFiltrosProps {
  onAplicar: (filtros: PainelFiltrosState) => void;
  desabilitado?: boolean;
}

const CAMPO = "flex min-w-0 flex-col gap-1";
const LABEL = "text-xs font-medium text-slate-500";
const INPUT =
  "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";

export function PainelFiltros({ onAplicar, desabilitado = false }: PainelFiltrosProps) {
  const filtros = useBiiPainelStore((s) => s.filtros);
  const setFiltro = useBiiPainelStore((s) => s.setFiltro);
  const dados = useBiiPainelStore((s) => s.dados);
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);

  const pipelines = dados?.pipelines ?? [];
  const corretores = dados?.filtros.corretores ?? [];
  const origens = dados?.filtros.origens ?? [];
  const hoje = formatDateOnly(new Date());

  function escolherPreset(preset: PeriodoPreset) {
    setErroPeriodo(null);
    // Ao abrir "Personalizado", ja preenche com o periodo atual como ponto de partida.
    if (preset === "personalizado" && (!filtros.de || !filtros.ate)) {
      const atual = dados?.periodo ?? periodoDoPreset(Number(filtros.preset) || 6);
      setFiltro("de", atual.de);
      setFiltro("ate", atual.ate);
    }
    setFiltro("preset", preset);
  }

  function aplicar(event: React.FormEvent) {
    event.preventDefault();
    if (filtros.preset === "personalizado") {
      const erro = validarPeriodo(filtros.de, filtros.ate);
      setErroPeriodo(erro);
      if (erro) return;
    }
    onAplicar(filtros);
  }

  function limpar() {
    setErroPeriodo(null);
    onAplicar(FILTROS_PADRAO);
  }

  return (
    <form onSubmit={aplicar} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Filtros do painel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <fieldset className={CAMPO}>
          <legend className={`${LABEL} mb-1`}>Período</legend>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
            {PERIODO_PRESETS.map((p) => {
              const ativo = filtros.preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => escolherPreset(p.value)}
                  aria-pressed={ativo}
                  className={`h-9 rounded-lg border px-2.5 text-sm font-medium transition ${
                    ativo
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className={CAMPO}>
          <span className={LABEL}>Pipeline</span>
          <select
            className={INPUT}
            value={filtros.pipelineId}
            onChange={(e) => setFiltro("pipelineId", e.target.value)}
            disabled={pipelines.length === 0}
          >
            {pipelines.length === 0 && <option value="">Padrão</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <label className={CAMPO}>
          <span className={LABEL}>Corretor</span>
          <select className={INPUT} value={filtros.corretorId} onChange={(e) => setFiltro("corretorId", e.target.value)}>
            <option value="">Todos{corretores.length > 0 ? ` (${corretores.length})` : ""}</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className={CAMPO}>
          <span className={LABEL}>Origem</span>
          <select className={INPUT} value={filtros.origem} onChange={(e) => setFiltro("origem", e.target.value)}>
            <option value="">Todas</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {getOrigemLabel(o)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={limpar}
            disabled={desabilitado}
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 lg:flex-none"
          >
            Limpar
          </button>
          <button
            type="submit"
            disabled={desabilitado}
            className="h-9 flex-1 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 lg:flex-none"
          >
            Aplicar
          </button>
        </div>
      </div>

      {filtros.preset === "personalizado" && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <label className={CAMPO}>
            <span className={LABEL}>De</span>
            <input
              type="date"
              className={INPUT}
              value={filtros.de}
              max={filtros.ate || hoje}
              onChange={(e) => setFiltro("de", e.target.value)}
              aria-invalid={erroPeriodo ? true : undefined}
              aria-describedby={erroPeriodo ? "bii-erro-periodo" : undefined}
            />
          </label>
          <label className={CAMPO}>
            <span className={LABEL}>Até</span>
            <input
              type="date"
              className={INPUT}
              value={filtros.ate}
              min={filtros.de || undefined}
              onChange={(e) => setFiltro("ate", e.target.value)}
              aria-invalid={erroPeriodo ? true : undefined}
              aria-describedby={erroPeriodo ? "bii-erro-periodo" : undefined}
            />
          </label>
        </div>
      )}
      {erroPeriodo && (
        <p id="bii-erro-periodo" role="alert" className="mt-2 text-xs text-red-600">
          {erroPeriodo}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Comparação com o período anterior de mesma duração. Todos os números desta aba vêm do <SourceBadge /> (Kanban:
        cards, etapas, ganho e perda).
      </p>
    </form>
  );
}
