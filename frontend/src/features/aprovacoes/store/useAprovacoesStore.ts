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

export interface CadastroAprovadoComContrato {
  id: string;
  name: string;
  email: string;
  roleName: string;
  statusContrato: "sem_contrato" | "aguardando_assinaturas" | "concluido" | "cancelado" | "rascunho";
  envelopeId: string | null;
}

interface AprovacoesState {
  pendentes: CadastroPendente[];
  aprovados: CadastroAprovadoComContrato[];
  superiores: SuperiorCandidate[];
  isLoading: boolean;
  isLoadingAprovados: boolean;
  isSaving: boolean;
  selectedId: string | null;

  setPendentes: (pendentes: CadastroPendente[]) => void;
  setAprovados: (aprovados: CadastroAprovadoComContrato[]) => void;
  setSuperiores: (superiores: SuperiorCandidate[]) => void;
  setLoading: (isLoading: boolean) => void;
  setLoadingAprovados: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  selectCadastro: (id: string | null) => void;
  removePendente: (id: string) => void;
}

export const useAprovacoesStore = create<AprovacoesState>((set, get) => ({
  pendentes: [],
  aprovados: [],
  superiores: [],
  isLoading: false,
  isLoadingAprovados: false,
  isSaving: false,
  selectedId: null,

  setPendentes: (pendentes) => set({ pendentes }),
  setAprovados: (aprovados) => set({ aprovados }),
  setSuperiores: (superiores) => set({ superiores }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingAprovados: (isLoadingAprovados) => set({ isLoadingAprovados }),
  setSaving: (isSaving) => set({ isSaving }),
  selectCadastro: (selectedId) => set({ selectedId }),
  removePendente: (id) =>
    set({
      pendentes: get().pendentes.filter((p) => p.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),
}));
