// src/features/configuracoes/components/DadosEmpresaTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface TenantConfig {
  id: string;
  name: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
}

// Formulario simples (1 GET + 1 PATCH) - sem store/hook dedicados de
// proposito, nao ha estado nenhum compartilhado com outra aba.
export function DadosEmpresaTab() {
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<TenantConfig>("/configuracoes/empresa")
      .then((config) => {
        setName(config.name ?? "");
        setCnpj(config.cnpj ?? "");
        setEndereco(config.endereco ?? "");
        setNumero(config.numero ?? "");
        setComplemento(config.complemento ?? "");
        setBairro(config.bairro ?? "");
        setCep(config.cep ?? "");
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar os dados da empresa.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("/configuracoes/empresa", {
        method: "PATCH",
        body: JSON.stringify({ name, cnpj, endereco, numero, complemento, bairro, cep }),
      });
      setSavedAt(Date.now());
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar os dados da empresa.");
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
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Dados da Empresa</h2>
      <p className="mb-4 text-xs text-slate-500">
        Usados para preencher contratos gerados automaticamente (ex: contrato de prestação de serviço de
        corretores/parceiros).
      </p>

      <div className="space-y-4">
        <Field label="Razão Social">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="config-name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
          />
        </Field>

        <Field label="CNPJ">
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            data-testid="config-cnpj"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Endereço">
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                data-testid="config-endereco"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
          </div>
          <Field label="Número">
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              data-testid="config-numero"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Complemento">
            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              data-testid="config-complemento"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </Field>
          <Field label="Bairro">
            <input
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              data-testid="config-bairro"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </Field>
        </div>

        <div className="max-w-[160px]">
          <Field label="CEP">
            <input
              type="text"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              data-testid="config-cep"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="config-save-button"
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
