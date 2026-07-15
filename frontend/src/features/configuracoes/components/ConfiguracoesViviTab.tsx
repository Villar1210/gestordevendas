// src/features/configuracoes/components/ConfiguracoesViviTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface ViviConfig {
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteHis1: number;
  limiteHis2: number;
  limiteHmp: number;
}

// Preco minimo (usado so no texto do prompt) + as 4 faixas de renda que
// classificarRenda() usa de verdade para classificar HIS1/HIS2/HMP/R2V/
// SEM_PERFIL - as mesmas 4 faixas tambem sao interpoladas no prompt da
// VIVI (ver buildViviSystemPrompt no backend), entao editar aqui muda os
// dois ao mesmo tempo, sempre em sincronia.
export function ConfiguracoesViviTab() {
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [precoMinimo, setPrecoMinimo] = useState("");
  const [limiteSemPerfil, setLimiteSemPerfil] = useState("");
  const [limiteHis1, setLimiteHis1] = useState("");
  const [limiteHis2, setLimiteHis2] = useState("");
  const [limiteHmp, setLimiteHmp] = useState("");

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<ViviConfig>("/vivi/config")
      .then((config) => {
        setPrecoMinimo(String(config.precoMinimo));
        setLimiteSemPerfil(String(config.limiteSemPerfil));
        setLimiteHis1(String(config.limiteHis1));
        setLimiteHis2(String(config.limiteHis2));
        setLimiteHmp(String(config.limiteHmp));
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar as configuracoes da VIVI.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const values = {
      precoMinimo: Number(precoMinimo),
      limiteSemPerfil: Number(limiteSemPerfil),
      limiteHis1: Number(limiteHis1),
      limiteHis2: Number(limiteHis2),
      limiteHmp: Number(limiteHmp),
    };

    if (Object.values(values).some((v) => Number.isNaN(v) || v <= 0)) {
      alert("Todos os valores precisam ser numeros maiores que zero.");
      return;
    }
    if (
      !(
        values.limiteSemPerfil < values.limiteHis1 &&
        values.limiteHis1 < values.limiteHis2 &&
        values.limiteHis2 < values.limiteHmp
      )
    ) {
      alert("As faixas de renda precisam ser crescentes: Sem Perfil < HIS1 < HIS2 < HMP.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/vivi/config", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setSavedAt(Date.now());
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar as configuracoes da VIVI.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Configurações da VIVI</h2>
      <p className="mb-4 text-xs text-slate-500">
        Preço mínimo (usado no texto que a VIVI envia ao lead) e as faixas de renda que classificam
        automaticamente cada lead (HIS1/HIS2/HMP/R2V/Sem Perfil) - os mesmos valores alimentam o prompt
        da IA e a classificação real.
      </p>

      <div className="space-y-4">
        <Field label="Preço mínimo (R$)">
          <input
            type="number"
            value={precoMinimo}
            onChange={(e) => setPrecoMinimo(e.target.value)}
            data-testid="vivi-preco-minimo"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
          />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Faixas de renda (crescente)
          </p>
          <div className="space-y-3">
            <Field label="Abaixo disto = Sem Perfil (R$)">
              <input
                type="number"
                value={limiteSemPerfil}
                onChange={(e) => setLimiteSemPerfil(e.target.value)}
                data-testid="vivi-limite-sem-perfil"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
            <Field label="Até isto = HIS1 (R$)">
              <input
                type="number"
                value={limiteHis1}
                onChange={(e) => setLimiteHis1(e.target.value)}
                data-testid="vivi-limite-his1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
            <Field label="Até isto = HIS2 (R$)">
              <input
                type="number"
                value={limiteHis2}
                onChange={(e) => setLimiteHis2(e.target.value)}
                data-testid="vivi-limite-his2"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
            <Field label="Até isto = HMP, acima = R2V (R$)">
              <input
                type="number"
                value={limiteHmp}
                onChange={(e) => setLimiteHmp(e.target.value)}
                data-testid="vivi-limite-hmp"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="vivi-save-button"
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
        {savedAt && !isSaving && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo com sucesso
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
