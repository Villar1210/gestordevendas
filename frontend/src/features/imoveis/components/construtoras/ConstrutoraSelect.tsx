// src/features/imoveis/components/construtoras/ConstrutoraSelect.tsx
// Construtoras (Fatia A): seletor de construtora do empreendimento, com
// "+ Nova construtora" no proprio seletor (mini-formulario so com o nome).
// value = id da construtora ("" = nenhuma).
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/core/api/client";
import { useConstrutoras } from "../../hooks/useConstrutoras";

const NOVA = "__nova__";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

interface Props {
  value: string;
  onChange: (construtoraId: string) => void;
  id?: string;
  disabled?: boolean;
  // Texto do rotulo da opcao vazia (ex.: "Sem construtora").
  placeholder?: string;
  // Nome sugerido para o mini-formulario (ex.: lido do book).
  nomeSugerido?: string;
}

export function ConstrutoraSelect({ value, onChange, id, disabled, placeholder = "Sem construtora", nomeSugerido }: Props) {
  const { construtoras, carregado, carregar, criar } = useConstrutoras();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!carregado) carregar().catch(() => undefined);
  }, [carregado, carregar]);

  function abrirNova() {
    setNome(nomeSugerido ?? "");
    setErro(null);
    setCriando(true);
  }

  async function salvarNova() {
    if (!nome.trim()) {
      setErro("Informe o nome da construtora.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criada = await criar({ nome: nome.trim() });
      onChange(criada.id);
      setCriando(false);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível criar a construtora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={criando ? NOVA : value}
        disabled={disabled || salvando}
        onChange={(e) => {
          if (e.target.value === NOVA) {
            abrirNova();
            return;
          }
          setCriando(false);
          onChange(e.target.value);
        }}
        className={inputClass}
      >
        <option value="">{carregado ? placeholder : "Carregando..."}</option>
        {construtoras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
        <option value={NOVA}>+ Nova construtora</option>
      </select>

      {criando && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label htmlFor={`${id ?? "construtora"}-nova`} className="mb-1 block text-xs font-medium text-slate-600">
            Nome da nova construtora
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${id ?? "construtora"}-nova`}
              type="text"
              value={nome}
              maxLength={150}
              autoFocus
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  salvarNova();
                }
              }}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={salvarNova}
              disabled={salvando}
              className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Criar
            </button>
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
          {erro && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {erro}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">Site, logo e textos ficam na aba Construtoras.</p>
        </div>
      )}
    </div>
  );
}
