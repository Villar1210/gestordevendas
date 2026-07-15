// src/features/configuracoes/components/EmailTemplatesTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  EMAIL_TEMPLATE_TIPOS,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  EMAIL_TEMPLATE_PADRAO,
  preencherEmailTemplatePreview,
} from "../constants";

interface EmailTemplateRecord {
  id: string;
  tipo: string;
  assunto: string;
  corpo: string;
}

export function EmailTemplatesTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(EMAIL_TEMPLATE_TIPOS[0].tipo);
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiRequest<EmailTemplateRecord[]>("/rh/email-templates")
      .then((lista) => {
        setTemplates(lista);
        const primeiro = lista.find((t) => t.tipo === tipoSelecionado) ?? lista[0];
        if (primeiro) {
          setTipoSelecionado(primeiro.tipo);
          setAssunto(primeiro.assunto);
          setCorpo(primeiro.corpo);
        }
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar os templates de e-mail.");
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selecionarTipo(tipo: string) {
    setTipoSelecionado(tipo);
    const template = templates.find((t) => t.tipo === tipo);
    setAssunto(template?.assunto ?? "");
    setCorpo(template?.corpo ?? "");
  }

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
    const padrao = EMAIL_TEMPLATE_PADRAO[tipoSelecionado];
    if (!padrao) return;
    setAssunto(padrao.assunto);
    setCorpo(padrao.corpo);
  }

  async function handleSalvar() {
    setIsSaving(true);
    try {
      const atualizado = await apiRequest<EmailTemplateRecord>(`/rh/email-templates/${tipoSelecionado}`, {
        method: "PATCH",
        body: JSON.stringify({ assunto, corpo }),
      });
      setTemplates((prev) => prev.map((t) => (t.tipo === tipoSelecionado ? atualizado : t)));
      alert("Template de e-mail salvo com sucesso.");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o template de e-mail.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando templates de e-mail...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr_240px]">
      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-2">
        {EMAIL_TEMPLATE_TIPOS.map((item) => (
          <button
            key={item.tipo}
            onClick={() => selecionarTipo(item.tipo)}
            data-testid={`email-template-tipo-${item.tipo}`}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              tipoSelecionado === item.tipo
                ? "bg-blue-700 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Assunto
          </label>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            maxLength={200}
            data-testid="email-template-assunto"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Corpo (HTML)
          </label>
          <textarea
            ref={textareaRef}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={14}
            data-testid="email-template-corpo"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSalvar}
              disabled={isSaving}
              data-testid="email-template-save-button"
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
          <p className="mt-2 text-sm font-medium text-slate-800">
            {preencherEmailTemplatePreview(assunto)}
          </p>
          <div
            className="mt-2 border-t border-slate-100 pt-2 text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: preencherEmailTemplatePreview(corpo) }}
          />
        </div>
      </div>

      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Placeholders</h3>
        <p className="mt-1 text-xs text-slate-400">Clique para inserir no corpo.</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {EMAIL_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
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
