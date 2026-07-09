// src/features/equipe/store/useEquipeStore.ts
import { create } from "zustand";

export interface Corretor {
  id: string;
  name: string;
  email: string;
  statusDisponibilidade: string;
  createdAt: string;
}

interface EquipeState {
  corretores: Corretor[];
  isLoading: boolean;
  corretorFormModalOpen: boolean;

  setCorretores: (corretores: Corretor[]) => void;
  setLoading: (isLoading: boolean) => void;
  addCorretor: (corretor: Corretor) => void;

  openCorretorFormModal: () => void;
  closeCorretorFormModal: () => void;
}

export const useEquipeStore = create<EquipeState>((set, get) => ({
  corretores: [],
  isLoading: false,
  corretorFormModalOpen: false,

  setCorretores: (corretores) => set({ corretores }),
  setLoading: (isLoading) => set({ isLoading }),
  addCorretor: (corretor) => set({ corretores: [corretor, ...get().corretores] }),

  openCorretorFormModal: () => set({ corretorFormModalOpen: true }),
  closeCorretorFormModal: () => set({ corretorFormModalOpen: false }),
}));
