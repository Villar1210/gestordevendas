// src/features/roleta/components/RoletaConfigCard.tsx
"use client";

import { useEffect, useRef } from "react";
import { Shuffle } from "lucide-react";
import { useRoletaStore } from "../store/useRoletaStore";
import { useRoletaIntegration } from "../hooks/useRoletaIntegration";

const selectClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export function RoletaConfigCard() {
  const config = useRoletaStore((state) => state.config);
  const isLoading = useRoletaStore((state) => state.isLoading);
  const isSaving = useRoletaStore((state) => state.isSaving);
  const { loadConfig, handleUpdateConfig } = useRoletaIntegration();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !config) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-400">Carregando configuracao da Roleta Online...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Roleta Online</h2>
        </div>

        <button
          onClick={() => handleUpdateConfig({ ativa: !config.ativa })}
          disabled={isSaving}
          role="switch"
          aria-checked={config.ativa}
          aria-label="Ativar ou desativar a Roleta Online"
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
            config.ativa ? "bg-blue-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              config.ativa ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        {config.ativa
          ? "Ativa: todo lead novo sem dono (Caixa de Entrada) e distribuido automaticamente entre os corretores online."
          : "Inativa: leads novos continuam caindo na Caixa de Entrada normalmente, sem distribuicao automatica."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Algoritmo</label>
          <select
            value={config.algoritmo}
            onChange={(e) => handleUpdateConfig({ algoritmo: e.target.value })}
            disabled={isSaving}
            className={selectClass}
          >
            <option value="round_robin">Round-robin</option>
            <option value="menor_fila">Menor fila</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {config.algoritmo === "menor_fila"
              ? "Escolhe sempre o corretor online com menos negocios ativos no momento."
              : "Alterna entre os corretores online, um de cada vez, em ordem fixa."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Modo</label>
          <select
            value={config.modo}
            onChange={(e) => handleUpdateConfig({ modo: e.target.value })}
            disabled={isSaving}
            className={selectClass}
          >
            <option value="semi_automatico">Semi-automatico</option>
            <option value="automatico">Automatico</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {config.modo === "automatico"
              ? "Atribui o lead direto ao corretor escolhido, com uma janela de tempo para aceitar (ver ao lado)."
              : "So sugere o corretor na Caixa de Entrada - alguem precisa confirmar antes de virar dono."}
          </p>
        </div>

        {config.modo === "automatico" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Tempo para aceite (minutos)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={config.timeoutAceiteMinutos}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!Number.isNaN(parsed)) {
                  handleUpdateConfig({ timeoutAceiteMinutos: parsed });
                }
              }}
              disabled={isSaving}
              className={selectClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Se o corretor nao clicar em &quot;Aceitar Lead&quot; dentro desse prazo, o lead e
              reatribuido automaticamente ao proximo corretor online.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
