// src/features/aprovacoes/store/useAprovacoesStore.ts
import { create } from "zustand";

export interface CadastroPendente {
  id: string;
  name: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  nomeImobiliaria: string | null;
  cnpj: string | null;
  creciJ: string | null;
  cargoNaEmpresa: string | null;
  cargoHierarquico: string | null;
  superiorId: string | null;
  tipoCliente: string | null;
  cep: string | null;
  endereco: string | null;
  statusCadastro: string;
  roleId: string;
  roleName: string;
  createdAt: string;
}

export interface SuperiorCandidate {
  id: string;
  name: string;
  cargoHierarquico: string | null;
}

interface AprovacoesState {
  pendentes: CadastroPendente[];
  superiores: SuperiorCandidate[];
  isLoading: boolean;
  isSaving: boolean;
  selectedId: string | null;

  setPendentes: (pendentes: CadastroPendente[]) => void;
  setSuperiores: (superiores: SuperiorCandidate[]) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  selectCadastro: (id: string | null) => void;
  removePendente: (id: string) => void;
}

export const useAprovacoesStore = create<AprovacoesState>((set, get) => ({
  pendentes: [],
  superiores: [],
  isLoading: false,
  isSaving: false,
  selectedId: null,

  setPendentes: (pendentes) => set({ pendentes }),
  setSuperiores: (superiores) => set({ superiores }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  selectCadastro: (selectedId) => set({ selectedId }),
  removePendente: (id) =>
    set({
      pendentes: get().pendentes.filter((p) => p.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),
}));
