// src/features/edoc/store/useEdocStore.ts
import { create } from "zustand";

export interface Envelope {
  id: string;
  title: string;
  status: string;
  documentUrl: string;
  documentHash: string;
  createdByUserId: string;
  createdAt: string;
  completedAt: string | null;
  signedDocumentUrl: string | null;
  emailSubject: string | null;
  emailMessage: string | null;
  recipientsCount: number;
}

// Contagens do dashboard (Fatia 4) - GET /edoc/stats.
export interface EnvelopeStats {
  total: number;
  rascunho: number;
  aguardando_assinaturas: number;
  concluido: number;
  cancelado: number;
}

export interface EnvelopeRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: string;
  signedAt: string | null;
}

interface EdocState {
  envelopes: Envelope[];
  isLoading: boolean;
  createModalOpen: boolean;
  // Presente quando o modal foi aberto para EDITAR um rascunho existente
  // (Fatia 4) - null quando e um envelope novo. O modal usa isso para
  // decidir entre POST (criar) e PATCH (atualizar rascunho).
  editingEnvelopeId: string | null;

  setEnvelopes: (envelopes: Envelope[]) => void;
  setLoading: (isLoading: boolean) => void;
  addEnvelope: (envelope: Envelope) => void;
  updateEnvelopeInPlace: (envelope: Envelope) => void;

  openCreateModal: () => void;
  openEditModal: (envelopeId: string) => void;
  closeCreateModal: () => void;
}

export const useEdocStore = create<EdocState>((set, get) => ({
  envelopes: [],
  isLoading: false,
  createModalOpen: false,
  editingEnvelopeId: null,

  setEnvelopes: (envelopes) => set({ envelopes }),
  setLoading: (isLoading) => set({ isLoading }),
  addEnvelope: (envelope) => set({ envelopes: [envelope, ...get().envelopes] }),
  updateEnvelopeInPlace: (envelope) =>
    set({
      envelopes: get().envelopes.map((e) => (e.id === envelope.id ? { ...e, ...envelope } : e)),
    }),

  openCreateModal: () => set({ createModalOpen: true, editingEnvelopeId: null }),
  openEditModal: (envelopeId) => set({ createModalOpen: true, editingEnvelopeId: envelopeId }),
  closeCreateModal: () => set({ createModalOpen: false, editingEnvelopeId: null }),
}));
