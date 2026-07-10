// src/features/edoc/components/CreateEnvelopeModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X, Plus, Trash2, ArrowUp, ArrowDown, FileText, Loader2 } from "lucide-react";
import { useEdocStore } from "../store/useEdocStore";
import { useEdocIntegration, CreateEnvelopeRecipientInput } from "../hooks/useEdocIntegration";
import type { FieldPosition } from "./FieldPositionEditor";

// ssr:false e obrigatorio aqui - ver comentario em PdfViewer.tsx.
const FieldPositionEditor = dynamic(
  () => import("./FieldPositionEditor").then((mod) => mod.FieldPositionEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
      </div>
    ),
  },
);

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600";

function emptyRecipient(): CreateEnvelopeRecipientInput {
  return { name: "", email: "" };
}

// Posicoes padrao ao entrar no passo 2 - escalonadas verticalmente na
// pagina 1 para nao ficarem uma em cima da outra; o admin arrasta a
// partir daqui. Mesmos defaults do schema (widthPercent/heightPercent).
function defaultFields(recipientCount: number): FieldPosition[] {
  return Array.from({ length: recipientCount }, (_, i) => ({
    recipientIndex: i,
    pageNumber: 1,
    xPercent: 0.1,
    yPercent: 0.1 + i * 0.14,
    widthPercent: 0.25,
    heightPercent: 0.08,
  }));
}

export function CreateEnvelopeModal() {
  const isOpen = useEdocStore((state) => state.createModalOpen);
  const closeCreateModal = useEdocStore((state) => state.closeCreateModal);
  const { handleCreateAndSendEnvelope } = useEdocIntegration();

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<CreateEnvelopeRecipientInput[]>([emptyRecipient()]);
  const [fields, setFields] = useState<FieldPosition[]>([]);
  const [saving, setSaving] = useState(false);

  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setTitle("");
    setFile(null);
    setRecipients([emptyRecipient()]);
    setFields([]);
  }, [isOpen]);

  if (!isOpen) return null;

  function updateRecipient(index: number, field: keyof CreateEnvelopeRecipientInput, value: string) {
    setRecipients((prev) =>
      prev.map((recipient, i) => (i === index ? { ...recipient, [field]: value } : recipient)),
    );
  }

  function addRecipient() {
    setRecipients((prev) => [...prev, emptyRecipient()]);
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function moveRecipient(index: number, direction: -1 | 1) {
    setRecipients((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleContinue() {
    if (!file) {
      alert("Selecione o arquivo PDF do documento.");
      return;
    }
    if (recipients.some((r) => !r.name.trim() || !r.email.trim())) {
      alert("Preencha nome e e-mail de todos os destinatarios.");
      return;
    }
    // Recomeca do zero de proposito - se o admin voltar e mexer na lista de
    // destinatarios, as posicoes antigas (por indice) nao fariam mais sentido.
    setFields(defaultFields(recipients.length));
    setStep(2);
  }

  async function handleSubmit() {
    if (!file) return;
    setSaving(true);
    try {
      await handleCreateAndSendEnvelope({ title, file, recipients, fields });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo Envelope"
      onClick={closeCreateModal}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all ${
          step === 1 ? "max-w-lg" : "max-w-3xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Novo Envelope</h2>
            <p className="text-xs text-slate-400">
              Passo {step} de 2 - {step === 1 ? "Documento e destinatarios" : "Posicionar assinaturas"}
            </p>
          </div>
          <button
            onClick={closeCreateModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-500">Titulo</label>
              <input
                type="text"
                required
                placeholder="Ex: Contrato de Locacao - Apto 302"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-500">Documento (PDF)</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-amber-400">
                <FileText className="h-4 w-4 shrink-0" />
                {file ? file.name : "Escolher arquivo PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  Destinatarios (ordem de assinatura)
                </p>
                <button
                  type="button"
                  onClick={addRecipient}
                  className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar destinatario
                </button>
              </div>

              <div className="space-y-2">
                {recipients.map((recipient, index) => (
                  <div key={index} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2">
                    <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        required
                        placeholder="Nome"
                        value={recipient.name}
                        onChange={(e) => updateRecipient(index, "name", e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="email"
                        required
                        placeholder="E-mail"
                        value={recipient.email}
                        onChange={(e) => updateRecipient(index, "email", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveRecipient(index, -1)}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Mover para cima"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRecipient(index, 1)}
                        disabled={index === recipients.length - 1}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        disabled={recipients.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30"
                        aria-label="Remover destinatario"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeCreateModal}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Arraste a caixa de cada destinatario para o local onde a assinatura dele deve
              aparecer. Use o seletor de pagina abaixo da lista se o campo for em outra pagina.
            </p>

            {fileUrl && (
              <FieldPositionEditor
                documentUrl={fileUrl}
                recipientNames={recipients.map((r) => r.name)}
                fields={fields}
                onChange={setFields}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {saving ? "Enviando..." : "Criar e Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
