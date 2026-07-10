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
  recipientsCount: number;
}

export interface EnvelopeRecipient {
  id: string;
  name: string;
  email: string;
  order: number;
  status: string;
  signedAt: string | null;
}

interface EdocState {
  envelopes: Envelope[];
  isLoading: boolean;
  createModalOpen: boolean;

  setEnvelopes: (envelopes: Envelope[]) => void;
  setLoading: (isLoading: boolean) => void;
  addEnvelope: (envelope: Envelope) => void;
  updateEnvelopeInPlace: (envelope: Envelope) => void;

  openCreateModal: () => void;
  closeCreateModal: () => void;
}

export const useEdocStore = create<EdocState>((set, get) => ({
  envelopes: [],
  isLoading: false,
  createModalOpen: false,

  setEnvelopes: (envelopes) => set({ envelopes }),
  setLoading: (isLoading) => set({ isLoading }),
  addEnvelope: (envelope) => set({ envelopes: [envelope, ...get().envelopes] }),
  updateEnvelopeInPlace: (envelope) =>
    set({
      envelopes: get().envelopes.map((e) => (e.id === envelope.id ? { ...e, ...envelope } : e)),
    }),

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),
}));
