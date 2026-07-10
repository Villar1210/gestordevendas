// src/features/edoc/hooks/useEdocIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useEdocStore, Envelope, EnvelopeRecipient } from "../store/useEdocStore";
import type { FieldPosition } from "../components/FieldPositionEditor";

export interface CreateEnvelopeRecipientInput {
  name: string;
  email: string;
}

export interface CreateEnvelopeInput {
  title: string;
  file: File;
  recipients: CreateEnvelopeRecipientInput[];
  fields: FieldPosition[];
}

export function useEdocIntegration() {
  const setEnvelopes = useEdocStore((state) => state.setEnvelopes);
  const setLoading = useEdocStore((state) => state.setLoading);
  const addEnvelope = useEdocStore((state) => state.addEnvelope);
  const updateEnvelopeInPlace = useEdocStore((state) => state.updateEnvelopeInPlace);
  const closeCreateModal = useEdocStore((state) => state.closeCreateModal);

  const loadEnvelopes = useCallback(async () => {
    setLoading(true);
    try {
      const envelopes = await apiRequest<Envelope[]>("/edoc/envelopes");
      setEnvelopes(envelopes);
    } finally {
      setLoading(false);
    }
  }, [setEnvelopes, setLoading]);

  const handleCreateAndSendEnvelope = useCallback(
    async (input: CreateEnvelopeInput) => {
      try {
        const formData = new FormData();
        formData.append("title", input.title);
        formData.append("recipients", JSON.stringify(input.recipients));
        formData.append("fields", JSON.stringify(input.fields));
        formData.append("file", input.file);

        const created = await apiRequest<{ envelope: Envelope }>("/edoc/envelopes", {
          method: "POST",
          body: formData,
        });
        const sent = await apiRequest<Envelope>(`/edoc/envelopes/${created.envelope.id}/send`, {
          method: "POST",
        });

        addEnvelope(sent);
        closeCreateModal();
        return sent;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o envelope.");
        return null;
      }
    },
    [addEnvelope, closeCreateModal],
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
    handleCreateAndSendEnvelope,
    handleGetEnvelopeDetail,
    handleCancelEnvelope,
  };
}
