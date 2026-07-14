// src/features/aprovacoes/components/ContratoTemplateTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  CONTRATO_TEMPLATE_PLACEHOLDERS,
  DEFAULT_CONTRATO_TEMPLATE_NOME,
  DEFAULT_CONTRATO_TEMPLATE_CORPO,
  preencherContratoTemplatePreview,
} from "../constants";

interface ContratoTemplateRecord {
  id: string;
  nome: string;
  corpo: string;
}

export function ContratoTemplateTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    apiRequest<ContratoTemplateRecord>("/rh/contrato-template")
      .then((template) => {
        if (!active) return;
        setNome(template.nome);
        setCorpo(template.corpo);
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o template de contrato.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function insertPlaceholder(token: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setCorpo((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart ?? corpo.length;
    const end = textarea.selectionEnd ?? corpo.length;
    const next = corpo.slice(0, start) + token + corpo.slice(end);
    setCorpo(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleRestaurarPadrao() {
    setNome(DEFAULT_CONTRATO_TEMPLATE_NOME);
    setCorpo(DEFAULT_CONTRATO_TEMPLATE_CORPO);
  }

  async function handleSalvar() {
    setIsSaving(true);
    try {
      await apiRequest("/rh/contrato-template", {
        method: "PATCH",
        body: JSON.stringify({ nome, corpo }),
      });
      alert("Template de contrato salvo com sucesso.");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o template de contrato.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando template de contrato...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Nome do template
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={150}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Corpo do contrato
          </label>
          <textarea
            ref={textareaRef}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={22}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSalvar}
              disabled={isSaving}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={handleRestaurarPadrao}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Restaurar Padrão
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Preview (dados fictícios)
          </h3>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {preencherContratoTemplatePreview(corpo)}
          </pre>
        </div>
      </div>

      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Placeholders</h3>
        <p className="mt-1 text-xs text-slate-400">Clique para inserir no cursor.</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {CONTRATO_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
            <button
              key={placeholder.token}
              type="button"
              title={placeholder.label}
              onClick={() => insertPlaceholder(placeholder.token)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-left font-mono text-xs text-blue-700 transition hover:bg-blue-50"
            >
              {placeholder.token}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
