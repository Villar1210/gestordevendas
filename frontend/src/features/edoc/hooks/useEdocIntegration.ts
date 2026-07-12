// src/features/edoc/hooks/useEdocIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useEdocStore, Envelope, EnvelopeRecipient, EnvelopeStats } from "../store/useEdocStore";
import type { FieldPosition } from "../components/FieldPositionEditor";

export interface CreateEnvelopeRecipientInput {
  name: string;
  email: string;
  role: string;
}

// Usado tanto para criar (POST) quanto para atualizar um rascunho (PATCH) -
// envelopeId presente = modo edicao. file nulo em modo edicao significa
// "nao trocar o documento" (o backend so troca quando um arquivo chega).
export interface SaveEnvelopeInput {
  envelopeId?: string;
  title: string;
  file: File | null;
  recipients: CreateEnvelopeRecipientInput[];
  fields: FieldPosition[];
  emailSubject?: string;
  emailMessage?: string;
}

// Campo como devolvido por GET /edoc/envelopes/:id/edit - identificado por
// recipientId (FK real), nao por recipientIndex (que so existe depois que
// o modal reconstroi o array local de participantes - ver
// CreateEnvelopeModal.tsx, que mapeia recipientId -> indice local).
export interface EnvelopeForEditField {
  recipientId: string;
  tipo: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface EnvelopeForEdit {
  envelope: Envelope;
  recipients: EnvelopeRecipient[];
  fields: EnvelopeForEditField[];
}

function buildEnvelopeFormData(input: SaveEnvelopeInput): FormData {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("recipients", JSON.stringify(input.recipients));
  formData.append("fields", JSON.stringify(input.fields));
  if (input.emailSubject !== undefined) formData.append("emailSubject", input.emailSubject);
  if (input.emailMessage !== undefined) formData.append("emailMessage", input.emailMessage);
  if (input.file) formData.append("file", input.file);
  return formData;
}

export function useEdocIntegration() {
  const setEnvelopes = useEdocStore((state) => state.setEnvelopes);
  const setLoading = useEdocStore((state) => state.setLoading);
  const addEnvelope = useEdocStore((state) => state.addEnvelope);
  const updateEnvelopeInPlace = useEdocStore((state) => state.updateEnvelopeInPlace);
  const closeCreateModal = useEdocStore((state) => state.closeCreateModal);

  const loadEnvelopes = useCallback(
    async (filter?: { status?: string; search?: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter?.status) params.set("status", filter.status);
        if (filter?.search) params.set("search", filter.search);
        const query = params.toString();
        const envelopes = await apiRequest<Envelope[]>(
          `/edoc/envelopes${query ? `?${query}` : ""}`,
        );
        setEnvelopes(envelopes);
      } finally {
        setLoading(false);
      }
    },
    [setEnvelopes, setLoading],
  );

  const loadStats = useCallback(async (): Promise<EnvelopeStats | null> => {
    try {
      return await apiRequest<EnvelopeStats>("/edoc/stats");
    } catch {
      return null;
    }
  }, []);

  // Cria (POST) ou atualiza um rascunho existente (PATCH), SEM enviar
  // e-mails - usado pelo botao "Salvar rascunho" (Fatia 4).
  const handleSaveDraft = useCallback(
    async (input: SaveEnvelopeInput): Promise<Envelope | null> => {
      try {
        const formData = buildEnvelopeFormData(input);
        const isEditing = !!input.envelopeId;
        const result = isEditing
          ? await apiRequest<{ envelope: Envelope }>(`/edoc/envelopes/${input.envelopeId}`, {
              method: "PATCH",
              body: formData,
            })
          : await apiRequest<{ envelope: Envelope }>("/edoc/envelopes", {
              method: "POST",
              body: formData,
            });

        if (isEditing) {
          updateEnvelopeInPlace(result.envelope);
        } else {
          addEnvelope(result.envelope);
        }
        closeCreateModal();
        return result.envelope;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o rascunho.");
        return null;
      }
    },
    [addEnvelope, updateEnvelopeInPlace, closeCreateModal],
  );

  // Cria/atualiza e ja envia para o primeiro participante da sequencia.
  const handleCreateAndSendEnvelope = useCallback(
    async (input: SaveEnvelopeInput): Promise<Envelope | null> => {
      try {
        const formData = buildEnvelopeFormData(input);
        const isEditing = !!input.envelopeId;
        const saved = isEditing
          ? await apiRequest<{ envelope: Envelope }>(`/edoc/envelopes/${input.envelopeId}`, {
              method: "PATCH",
              body: formData,
            })
          : await apiRequest<{ envelope: Envelope }>("/edoc/envelopes", {
              method: "POST",
              body: formData,
            });

        const sent = await apiRequest<Envelope>(`/edoc/envelopes/${saved.envelope.id}/send`, {
          method: "POST",
        });

        if (isEditing) {
          updateEnvelopeInPlace(sent);
        } else {
          addEnvelope(sent);
        }
        closeCreateModal();
        return sent;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o envelope.");
        return null;
      }
    },
    [addEnvelope, updateEnvelopeInPlace, closeCreateModal],
  );

  const handleGetEnvelopeForEdit = useCallback(
    async (envelopeId: string): Promise<EnvelopeForEdit | null> => {
      try {
        return await apiRequest<EnvelopeForEdit>(`/edoc/envelopes/${envelopeId}/edit`);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o rascunho.");
        return null;
      }
    },
    [],
  );

  const handleGetEnvelopeDetail = useCallback(async (envelopeId: string) => {
    try {
      return await apiRequest<{ envelope: Envelope; recipients: EnvelopeRecipient[] }>(
        `/edoc/envelopes/${envelopeId}`,
      );
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o envelope.");
      return null;
    }
  }, []);

  const handleCancelEnvelope = useCallback(
    async (envelopeId: string) => {
      try {
        const updated = await apiRequest<Envelope>(`/edoc/envelopes/${envelopeId}/cancel`, {
          method: "POST",
        });
        updateEnvelopeInPlace(updated);
        return updated;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel cancelar o envelope.");
        return null;
      }
    },
    [updateEnvelopeInPlace],
  );

  return {
    loadEnvelopes,
    loadStats,
    handleSaveDraft,
    handleCreateAndSendEnvelope,
    handleGetEnvelopeForEdit,
    handleGetEnvelopeDetail,
    handleCancelEnvelope,
  };
}
