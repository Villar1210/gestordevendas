// src/features/edoc/components/CreateEnvelopeModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X, Plus, Trash2, ArrowUp, ArrowDown, FileText, Loader2 } from "lucide-react";
import { useEdocStore } from "../store/useEdocStore";
import { useEdocIntegration, CreateEnvelopeRecipientInput } from "../hooks/useEdocIntegration";
import type { FieldPosition } from "./FieldPositionEditor";
import { ROLE_OPTIONS, FIELD_TIPO_DEFAULTS, getRoleOption } from "../constants";

// ssr:false e obrigatorio aqui - ver comentario em PdfViewer.tsx.
const FieldPositionEditor = dynamic(
  () => import("./FieldPositionEditor").then((mod) => mod.FieldPositionEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    ),
  },
);

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

function emptyRecipient(role: string): CreateEnvelopeRecipientInput {
  return { name: "", email: "", role };
}

// Posicoes padrao ao entrar no passo 2 - escalonadas verticalmente na
// pagina 1 para nao ficarem uma em cima da outra; o admin arrasta a
// partir daqui. So a assinatura vem por padrao - rubrica e adicionada sob
// demanda no editor (ver FieldPositionEditor). Mesmos defaults de
// widthPercent/heightPercent do tipo "assinatura".
function defaultFields(recipientCount: number): FieldPosition[] {
  const defaults = FIELD_TIPO_DEFAULTS.assinatura;
  return Array.from({ length: recipientCount }, (_, i) => ({
    recipientIndex: i,
    tipo: "assinatura" as const,
    pageNumber: 1,
    xPercent: 0.1,
    yPercent: 0.1 + i * 0.14,
    widthPercent: defaults.widthPercent,
    heightPercent: defaults.heightPercent,
  }));
}

export function CreateEnvelopeModal() {
  const isOpen = useEdocStore((state) => state.createModalOpen);
  const closeCreateModal = useEdocStore((state) => state.closeCreateModal);
  const { handleCreateAndSendEnvelope } = useEdocIntegration();

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<CreateEnvelopeRecipientInput[]>([
    emptyRecipient("destinatario"),
  ]);
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
    setRecipients([emptyRecipient("destinatario")]);
    setFields([]);
  }, [isOpen]);

  if (!isOpen) return null;

  function updateRecipient(index: number, field: keyof CreateEnvelopeRecipientInput, value: string) {
    setRecipients((prev) =>
      prev.map((recipient, i) => (i === index ? { ...recipient, [field]: value } : recipient)),
    );
  }

  function addRecipient(role: string) {
    setRecipients((prev) => [...prev, emptyRecipient(role)]);
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
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-blue-400">
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
              <p className="mb-2 text-sm font-medium text-slate-600">Participantes</p>

              <div className="mb-3 flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <span
                    key={role.value}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${role.badgeClassName}`}
                  >
                    {role.label} - {role.description}
                  </span>
                ))}
              </div>

              <div className="space-y-2">
                {recipients.map((recipient, index) => {
                  const role = getRoleOption(recipient.role);
                  const orderInGroup =
                    recipients.slice(0, index + 1).filter((r) => r.role === recipient.role).length;
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-2 rounded-lg border p-2 ${role.cardBorderClassName}`}
                    >
                      <span
                        className={`mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${role.dotClassName}`}
                      >
                        {orderInGroup}
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
                        <select
                          value={recipient.role}
                          onChange={(e) => updateRecipient(index, "role", e.target.value)}
                          className={inputClass}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
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
                          aria-label="Remover participante"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => addRecipient(role.value)}
                    className={`flex items-center gap-1 text-xs font-medium ${role.buttonClassName}`}
                  >
                    <Plus className="h-3.5 w-3.5" /> {role.label}
                  </button>
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
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Arraste a caixa de cada participante para o local onde o campo deve aparecer.
              Destinatarios e Remetentes podem adicionar rubrica (repetida em todas as paginas)
              alem da assinatura; Testemunhas so tem assinatura, na ultima pagina.
            </p>

            {fileUrl && (
              <FieldPositionEditor
                documentUrl={fileUrl}
                recipients={recipients.map((r) => ({ name: r.name, role: r.role }))}
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
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
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
