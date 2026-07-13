// src/features/edoc/components/CreateEnvelopeModal.tsx
// Fatia 4: alem de criar, este modal agora tambem EDITA um rascunho
// existente (ver useEdocStore.editingEnvelopeId) - corrige o "bug do
// rascunho" (antes, um envelope em rascunho nao tinha como ser reaberto).
// Ganhou tambem: dropzone de documento (PDF/Word/Excel), validacao
// inline de participantes, passo 3 "Mensagem do E-mail" e botao "Salvar
// rascunho" disponivel em qualquer passo.
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useEdocStore } from "../store/useEdocStore";
import {
  useEdocIntegration,
  CreateEnvelopeRecipientInput,
  SaveEnvelopeInput,
} from "../hooks/useEdocIntegration";
import type { FieldPosition } from "./FieldPositionEditor";
import { DocumentDropzone } from "./DocumentDropzone";
import {
  ROLE_OPTIONS,
  FIELD_TIPO_DEFAULTS,
  getRoleOption,
  DEFAULT_EMAIL_SUBJECT,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "../constants";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/core/api/client";

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
const inputErrorClass =
  "w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// Ordem real de assinatura (grupo + ordem dentro do grupo) - espelha
// domain/services/recipient-sequence.ts do backend, so para exibir os
// participantes na ordem certa ao reabrir um rascunho para edicao.
const ROLE_GROUP_RANK: Record<string, number> = { destinatario: 1, remetente: 2, testemunha: 3 };

type RecipientErrors = Record<number, { name?: string; email?: string }>;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyRecipient(role: string): CreateEnvelopeRecipientInput {
  return { name: "", email: "", role };
}

// Posicoes padrao ao (re)entrar no passo 2 - escalonadas verticalmente na
// pagina 1. So a assinatura vem por padrao - rubrica e adicionada sob
// demanda no editor (ver FieldPositionEditor).
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

// So a sequencia de roles importa para saber se as posicoes salvas ainda
// fazem sentido por indice - se o admin adicionar/remover/reordenar
// participantes, os campos antigos (por indice) deixam de fazer sentido.
function recipientsFieldsKey(list: CreateEnvelopeRecipientInput[]): string {
  return list.map((r) => r.role).join("|");
}

export function CreateEnvelopeModal() {
  const isOpen = useEdocStore((state) => state.createModalOpen);
  const editingEnvelopeId = useEdocStore((state) => state.editingEnvelopeId);
  const closeCreateModal = useEdocStore((state) => state.closeCreateModal);
  const { handleCreateAndSendEnvelope, handleSaveDraft, handleGetEnvelopeForEdit } =
    useEdocIntegration();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Envelope ja salvo NESTA sessao do modal (seja porque estamos editando
  // um rascunho existente, seja porque "Salvar rascunho" ja rodou uma vez)
  // - a partir daqui, salvamentos seguintes viram PATCH, nao um novo POST.
  const [savedEnvelopeId, setSavedEnvelopeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingDocumentUrl, setExistingDocumentUrl] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<CreateEnvelopeRecipientInput[]>([
    emptyRecipient("destinatario"),
  ]);
  const [recipientErrors, setRecipientErrors] = useState<RecipientErrors>({});
  const [fields, setFields] = useState<FieldPosition[]>([]);
  const [fieldsSyncKey, setFieldsSyncKey] = useState("");
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailMessage, setEmailMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  // previewPdfUrl: URL de um blob PDF para o FieldPositionEditor.
  // Para PDFs: URL.createObjectURL(file) direto.
  // Para Word/Excel: PDF convertido via POST /edoc/convert-preview (backend
  //   chama LibreOffice) - a conversao e so para preview; o arquivo original
  //   e o que sera enviado ao salvar/enviar, e o backend converte de novo.
  // Para documentos de rascunho ja no servidor: null (usa existingDocumentUrl).
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewConverting, setPreviewConverting] = useState(false);

  // URL usada pelo FieldPositionEditor: PDF local (novo arquivo selecionado)
  // ou PDF ja salvo no servidor (rascunho existente).
  const editorUrl = previewPdfUrl ?? (existingDocumentUrl ? `${API_BASE_URL}${existingDocumentUrl}` : null);

  // Quando o usuario troca o arquivo, atualiza o preview PDF para o editor.
  useEffect(() => {
    if (!file) {
      setPreviewPdfUrl(null);
      return;
    }

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const url = URL.createObjectURL(file);
      setPreviewPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    // Word/Excel: converte via backend e usa o PDF resultante como preview.
    let cancelled = false;
    let blobUrl: string | null = null;
    setPreviewConverting(true);
    setPreviewPdfUrl(null);

    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_BASE_URL}/edoc/convert-preview`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setPreviewPdfUrl(blobUrl);
      })
      .catch(() => {
        // Conversao falhou no servidor: o editor ficara vazio (sem preview),
        // mas o usuario ainda pode continuar - a conversao real acontece ao
        // salvar/enviar e o backend exibira um erro claro se falhar de novo.
      })
      .finally(() => {
        if (!cancelled) setPreviewConverting(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setTitle("");
    setFile(null);
    setExistingDocumentUrl(null);
    setPreviewPdfUrl(null);
    setPreviewConverting(false);
    setRecipients([emptyRecipient("destinatario")]);
    setRecipientErrors({});
    setFields([]);
    setFieldsSyncKey("");
    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
    setEmailMessage("");
    setSavedEnvelopeId(editingEnvelopeId);

    if (!editingEnvelopeId) return;

    setLoadingEdit(true);
    handleGetEnvelopeForEdit(editingEnvelopeId)
      .then((data) => {
        if (!data) return;

        setTitle(data.envelope.title);
        setExistingDocumentUrl(data.envelope.documentUrl);
        setEmailSubject(data.envelope.emailSubject || DEFAULT_EMAIL_SUBJECT);
        setEmailMessage(data.envelope.emailMessage || "");

        const sortedRecipients = [...data.recipients].sort((a, b) => {
          const groupDiff = (ROLE_GROUP_RANK[a.role] ?? 99) - (ROLE_GROUP_RANK[b.role] ?? 99);
          if (groupDiff !== 0) return groupDiff;
          return a.order - b.order;
        });
        const recipientIdToIndex = new Map(sortedRecipients.map((r, i) => [r.id, i]));
        const localRecipients = sortedRecipients.map((r) => ({
          name: r.name,
          email: r.email,
          role: r.role,
        }));
        const localFields: FieldPosition[] = data.fields
          .map((f) => ({
            recipientIndex: recipientIdToIndex.get(f.recipientId) ?? 0,
            tipo: f.tipo as FieldPosition["tipo"],
            pageNumber: f.pageNumber,
            xPercent: f.xPercent,
            yPercent: f.yPercent,
            widthPercent: f.widthPercent,
            heightPercent: f.heightPercent,
          }))
          .sort((a, b) => a.recipientIndex - b.recipientIndex);

        setRecipients(localRecipients.length ? localRecipients : [emptyRecipient("destinatario")]);
        setFields(localFields);
        setFieldsSyncKey(recipientsFieldsKey(localRecipients));
      })
      .finally(() => setLoadingEdit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingEnvelopeId]);

  if (!isOpen) return null;

  function updateRecipient(index: number, field: keyof CreateEnvelopeRecipientInput, value: string) {
    setRecipients((prev) =>
      prev.map((recipient, i) => (i === index ? { ...recipient, [field]: value } : recipient)),
    );
    setRecipientErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function addRecipient(role: string) {
    setRecipients((prev) => [...prev, emptyRecipient(role)]);
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
    setRecipientErrors((prev) => {
      const next: RecipientErrors = {};
      Object.entries(prev).forEach(([key, value]) => {
        const i = Number(key);
        if (i < index) next[i] = value;
        else if (i > index) next[i - 1] = value;
      });
      return next;
    });
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

  // Validacao inline (Fatia 4) - mensagens em vermelho abaixo dos campos,
  // em vez do alert() generico usado antes.
  function validateRecipients(): boolean {
    const errors: RecipientErrors = {};
    recipients.forEach((r, i) => {
      const entry: { name?: string; email?: string } = {};
      if (!r.name.trim()) entry.name = "Nome obrigatorio";
      if (!r.email.trim() || !EMAIL_REGEX.test(r.email.trim())) entry.email = "E-mail invalido";
      if (entry.name || entry.email) errors[i] = entry;
    });
    setRecipientErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function syncFieldsWithRecipients() {
    const key = recipientsFieldsKey(recipients);
    if (fields.length === 0 || key !== fieldsSyncKey) {
      setFields(defaultFields(recipients.length));
      setFieldsSyncKey(key);
    }
  }

  function handleContinueToFields() {
    if (!file && !existingDocumentUrl) {
      alert("Selecione o arquivo do documento.");
      return;
    }
    if (!validateRecipients()) return;
    syncFieldsWithRecipients();
    setStep(2);
  }

  function buildSaveInput(): SaveEnvelopeInput {
    return {
      envelopeId: savedEnvelopeId ?? undefined,
      title,
      file,
      recipients,
      fields,
      emailSubject,
      emailMessage,
    };
  }

  async function handleSaveDraftClick() {
    if (!file && !existingDocumentUrl) {
      alert("Selecione o arquivo do documento.");
      return;
    }
    if (!validateRecipients()) return;
    setSavingDraft(true);
    try {
      const saved = await handleSaveDraft(buildSaveInput());
      if (saved) setSavedEnvelopeId(saved.id);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    if (!file && !existingDocumentUrl) return;
    setSaving(true);
    try {
      await handleCreateAndSendEnvelope(buildSaveInput());
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!editingEnvelopeId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Editar Rascunho" : "Novo Envelope"}
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
            <h2 className="text-lg font-semibold text-slate-800">
              {isEditing ? "Editar Rascunho" : "Novo Envelope"}
            </h2>
            <p className="text-xs text-slate-400">
              Passo {step} de 3 -{" "}
              {step === 1
                ? "Documento e participantes"
                : step === 2
                  ? "Posicionar campos"
                  : "Mensagem do e-mail"}
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

        {loadingEdit ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : step === 1 ? (
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

            <DocumentDropzone
              file={file}
              hasExistingDocument={!!existingDocumentUrl}
              onFileSelected={setFile}
            />

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
                  const errors = recipientErrors[index];
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
                        <div>
                          <input
                            type="text"
                            placeholder="Nome"
                            value={recipient.name}
                            onChange={(e) => updateRecipient(index, "name", e.target.value)}
                            className={errors?.name ? inputErrorClass : inputClass}
                          />
                          {errors?.name && (
                            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="email"
                            placeholder="E-mail"
                            value={recipient.email}
                            onChange={(e) => updateRecipient(index, "email", e.target.value)}
                            className={errors?.email ? inputErrorClass : inputClass}
                          />
                          {errors?.email && (
                            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                          )}
                        </div>
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
                onClick={handleSaveDraftClick}
                disabled={savingDraft}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {savingDraft ? "Salvando..." : "Salvar rascunho"}
              </button>
              <button
                type="button"
                onClick={handleContinueToFields}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Arraste a caixa de cada participante para o local onde o campo deve aparecer.
              Destinatarios e Remetentes podem adicionar rubrica (repetida em todas as paginas)
              alem da assinatura; Testemunhas so tem assinatura, na ultima pagina.
            </p>

            {previewConverting ? (
              <div className="flex h-64 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm text-slate-500">Convertendo arquivo para PDF…</span>
              </div>
            ) : editorUrl ? (
              <FieldPositionEditor
                documentUrl={editorUrl}
                recipients={recipients.map((r) => ({ name: r.name, role: r.role }))}
                fields={fields}
                onChange={setFields}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-400">
                  Nao foi possivel gerar o preview. Voce ainda pode continuar — o
                  documento sera convertido ao salvar.
                </span>
              </div>
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
                onClick={handleSaveDraftClick}
                disabled={savingDraft}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {savingDraft ? "Salvando..." : "Salvar rascunho"}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Personalize o assunto e a mensagem do e-mail enviado a cada participante quando for
              a vez dele assinar. Deixe em branco para usar o padrao.
            </p>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-slate-500">Assunto</label>
                <span className="text-xs text-slate-400">
                  {emailSubject.length}/{EMAIL_SUBJECT_MAX_LENGTH}
                </span>
              </div>
              <input
                type="text"
                value={emailSubject}
                maxLength={EMAIL_SUBJECT_MAX_LENGTH}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-500">
                Mensagem <span className="text-slate-400">(opcional)</span>
              </label>
              <textarea
                rows={5}
                placeholder="Ex: Segue o contrato combinado, qualquer duvida me avise."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveDraftClick}
                disabled={savingDraft}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {savingDraft ? "Salvando..." : "Salvar rascunho"}
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
