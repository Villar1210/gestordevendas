// src/features/roleta/store/useRoletaStore.ts
import { create } from "zustand";

export interface RoletaConfig {
  id: string;
  algoritmo: string;
  modo: string;
  ativa: boolean;
  ultimoCorretorId: string | null;
  timeoutAceiteMinutos: number;
  updatedAt: string;
}

interface RoletaState {
  config: RoletaConfig | null;
  isLoading: boolean;
  isSaving: boolean;

  setConfig: (config: RoletaConfig) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
}

export const useRoletaStore = create<RoletaState>((set) => ({
  config: null,
  isLoading: false,
  isSaving: false,

  setConfig: (config) => set({ config }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
}));
