// src/features/configuracoes/components/ConfiguracoesViviTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface ViviConfig {
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteFaixa1: number;
  limiteFaixa2: number;
  limiteFaixa3: number;
  limiteFaixa4: number;
  faixa1SubsidioMax: number | null;
  faixa1JurosMin: number | null;
  faixa1JurosMax: number | null;
  faixa1TetoFinanciamento: string | null;
  faixa1ExemploParcela: string | null;
  faixa2SubsidioMax: number | null;
  faixa2JurosMin: number | null;
  faixa2JurosMax: number | null;
  faixa2TetoFinanciamento: string | null;
  faixa2ExemploParcela: string | null;
  faixa3SubsidioMax: number | null;
  faixa3JurosMin: number | null;
  faixa3JurosMax: number | null;
  faixa3TetoFinanciamento: string | null;
  faixa3ExemploParcela: string | null;
  faixa4SubsidioMax: number | null;
  faixa4JurosMin: number | null;
  faixa4JurosMax: number | null;
  faixa4TetoFinanciamento: string | null;
  faixa4ExemploParcela: string | null;
}

// Espelha os 4 grupos de campo por faixa em ViviConfig (backend) - usado
// pra nao repetir 4x o mesmo bloco de JSX/estado na mao.
const FAIXAS = [1, 2, 3, 4] as const;
type FaixaNumero = (typeof FAIXAS)[number];

interface FaixaFormState {
  limite: string;
  subsidioMax: string;
  jurosMin: string;
  jurosMax: string;
  tetoFinanciamento: string;
  exemploParcela: string;
}

function emptyFaixaState(): FaixaFormState {
  return { limite: "", subsidioMax: "", jurosMin: "", jurosMax: "", tetoFinanciamento: "", exemploParcela: "" };
}

// "" -> null (campo opcional deixado em branco), string numerica -> Number.
function parseOptionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function parseOptionalString(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

export function ConfiguracoesViviTab() {
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [precoMinimo, setPrecoMinimo] = useState("");
  const [limiteSemPerfil, setLimiteSemPerfil] = useState("");
  const [faixas, setFaixas] = useState<Record<FaixaNumero, FaixaFormState>>({
    1: emptyFaixaState(),
    2: emptyFaixaState(),
    3: emptyFaixaState(),
    4: emptyFaixaState(),
  });

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<ViviConfig>("/vivi/config")
      .then((config) => {
        setPrecoMinimo(String(config.precoMinimo));
        setLimiteSemPerfil(String(config.limiteSemPerfil));
        setFaixas({
          1: {
            limite: String(config.limiteFaixa1),
            subsidioMax: config.faixa1SubsidioMax !== null ? String(config.faixa1SubsidioMax) : "",
            jurosMin: config.faixa1JurosMin !== null ? String(config.faixa1JurosMin) : "",
            jurosMax: config.faixa1JurosMax !== null ? String(config.faixa1JurosMax) : "",
            tetoFinanciamento: config.faixa1TetoFinanciamento ?? "",
            exemploParcela: config.faixa1ExemploParcela ?? "",
          },
          2: {
            limite: String(config.limiteFaixa2),
            subsidioMax: config.faixa2SubsidioMax !== null ? String(config.faixa2SubsidioMax) : "",
            jurosMin: config.faixa2JurosMin !== null ? String(config.faixa2JurosMin) : "",
            jurosMax: config.faixa2JurosMax !== null ? String(config.faixa2JurosMax) : "",
            tetoFinanciamento: config.faixa2TetoFinanciamento ?? "",
            exemploParcela: config.faixa2ExemploParcela ?? "",
          },
          3: {
            limite: String(config.limiteFaixa3),
            subsidioMax: config.faixa3SubsidioMax !== null ? String(config.faixa3SubsidioMax) : "",
            jurosMin: config.faixa3JurosMin !== null ? String(config.faixa3JurosMin) : "",
            jurosMax: config.faixa3JurosMax !== null ? String(config.faixa3JurosMax) : "",
            tetoFinanciamento: config.faixa3TetoFinanciamento ?? "",
            exemploParcela: config.faixa3ExemploParcela ?? "",
          },
          4: {
            limite: String(config.limiteFaixa4),
            subsidioMax: config.faixa4SubsidioMax !== null ? String(config.faixa4SubsidioMax) : "",
            jurosMin: config.faixa4JurosMin !== null ? String(config.faixa4JurosMin) : "",
            jurosMax: config.faixa4JurosMax !== null ? String(config.faixa4JurosMax) : "",
            tetoFinanciamento: config.faixa4TetoFinanciamento ?? "",
            exemploParcela: config.faixa4ExemploParcela ?? "",
          },
        });
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar as configuracoes da VIVI.");
      })
      .finally(() => setLoading(false));
  }, []);

  function updateFaixa(numero: FaixaNumero, campo: keyof FaixaFormState, valor: string) {
    setFaixas((prev) => ({ ...prev, [numero]: { ...prev[numero], [campo]: valor } }));
  }

  async function handleSave() {
    const precoMinimoNum = Number(precoMinimo);
    const limiteSemPerfilNum = Number(limiteSemPerfil);
    const limites = FAIXAS.map((n) => Number(faixas[n].limite));

    if (
      Number.isNaN(precoMinimoNum) ||
      precoMinimoNum <= 0 ||
      Number.isNaN(limiteSemPerfilNum) ||
      limiteSemPerfilNum <= 0 ||
      limites.some((v) => Number.isNaN(v) || v <= 0)
    ) {
      alert("Preço mínimo e as faixas de renda precisam ser números maiores que zero.");
      return;
    }
    if (
      !(
        limiteSemPerfilNum < limites[0] &&
        limites[0] < limites[1] &&
        limites[1] < limites[2] &&
        limites[2] < limites[3]
      )
    ) {
      alert("As faixas de renda precisam ser crescentes: Sem Perfil < Faixa 1 < Faixa 2 < Faixa 3 < Faixa 4.");
      return;
    }

    const values = {
      precoMinimo: precoMinimoNum,
      limiteSemPerfil: limiteSemPerfilNum,
      limiteFaixa1: limites[0],
      limiteFaixa2: limites[1],
      limiteFaixa3: limites[2],
      limiteFaixa4: limites[3],
      faixa1SubsidioMax: parseOptionalNumber(faixas[1].subsidioMax),
      faixa1JurosMin: parseOptionalNumber(faixas[1].jurosMin),
      faixa1JurosMax: parseOptionalNumber(faixas[1].jurosMax),
      faixa1TetoFinanciamento: parseOptionalString(faixas[1].tetoFinanciamento),
      faixa1ExemploParcela: parseOptionalString(faixas[1].exemploParcela),
      faixa2SubsidioMax: parseOptionalNumber(faixas[2].subsidioMax),
      faixa2JurosMin: parseOptionalNumber(faixas[2].jurosMin),
      faixa2JurosMax: parseOptionalNumber(faixas[2].jurosMax),
      faixa2TetoFinanciamento: parseOptionalString(faixas[2].tetoFinanciamento),
      faixa2ExemploParcela: parseOptionalString(faixas[2].exemploParcela),
      faixa3SubsidioMax: parseOptionalNumber(faixas[3].subsidioMax),
      faixa3JurosMin: parseOptionalNumber(faixas[3].jurosMin),
      faixa3JurosMax: parseOptionalNumber(faixas[3].jurosMax),
      faixa3TetoFinanciamento: parseOptionalString(faixas[3].tetoFinanciamento),
      faixa3ExemploParcela: parseOptionalString(faixas[3].exemploParcela),
      faixa4SubsidioMax: parseOptionalNumber(faixas[4].subsidioMax),
      faixa4JurosMin: parseOptionalNumber(faixas[4].jurosMin),
      faixa4JurosMax: parseOptionalNumber(faixas[4].jurosMax),
      faixa4TetoFinanciamento: parseOptionalString(faixas[4].tetoFinanciamento),
      faixa4ExemploParcela: parseOptionalString(faixas[4].exemploParcela),
    };

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
    <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Configurações da VIVI</h2>
      <p className="mb-4 text-xs text-slate-500">
        Preço mínimo (usado no texto que a VIVI envia ao lead) e as faixas de renda MCMV 2026 que
        classificam automaticamente cada lead (Faixa 1 a 4, ou Sem Perfil/acima da Faixa 4) - os
        mesmos valores alimentam o prompt da IA e a classificação real. A VIVI sempre fala desses
        números como estimativa, nunca como valor garantido.
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

        <Field label="Abaixo disto = Sem Perfil (R$)">
          <input
            type="number"
            value={limiteSemPerfil}
            onChange={(e) => setLimiteSemPerfil(e.target.value)}
            data-testid="vivi-limite-sem-perfil"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
          />
        </Field>
      </div>

      <div className="mt-6 space-y-4">
        {FAIXAS.map((numero) => (
          <div key={numero} className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Faixa {numero}
              {numero === 4 && " (MCMV Premium)"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Teto de renda da Faixa ${numero} (R$)`}>
                <input
                  type="number"
                  value={faixas[numero].limite}
                  onChange={(e) => updateFaixa(numero, "limite", e.target.value)}
                  data-testid={`vivi-limite-faixa${numero}`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Subsídio máximo (R$, opcional)">
                <input
                  type="number"
                  value={faixas[numero].subsidioMax}
                  onChange={(e) => updateFaixa(numero, "subsidioMax", e.target.value)}
                  data-testid={`vivi-faixa${numero}-subsidio-max`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Juros mínimo (%, opcional)">
                <input
                  type="number"
                  step="0.01"
                  value={faixas[numero].jurosMin}
                  onChange={(e) => updateFaixa(numero, "jurosMin", e.target.value)}
                  data-testid={`vivi-faixa${numero}-juros-min`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Juros máximo (%, opcional)">
                <input
                  type="number"
                  step="0.01"
                  value={faixas[numero].jurosMax}
                  onChange={(e) => updateFaixa(numero, "jurosMax", e.target.value)}
                  data-testid={`vivi-faixa${numero}-juros-max`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Teto de financiamento (texto, opcional)">
                <input
                  type="text"
                  value={faixas[numero].tetoFinanciamento}
                  onChange={(e) => updateFaixa(numero, "tetoFinanciamento", e.target.value)}
                  placeholder="Ex: R$ 400 mil"
                  data-testid={`vivi-faixa${numero}-teto-financiamento`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Exemplo de parcela (texto, opcional)">
                <input
                  type="text"
                  value={faixas[numero].exemploParcela}
                  onChange={(e) => updateFaixa(numero, "exemploParcela", e.target.value)}
                  placeholder="Ex: parcelas a partir de R$ 899"
                  data-testid={`vivi-faixa${numero}-exemplo-parcela`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </Field>
            </div>
          </div>
        ))}
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
