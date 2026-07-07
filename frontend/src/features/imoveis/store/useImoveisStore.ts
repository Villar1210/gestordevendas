// src/features/imoveis/store/useImoveisStore.ts
import { create } from "zustand";

export interface ImovelPhoto {
  id: string;
  url: string;
  order: number;
}

export interface Imovel {
  id: string;
  empreendimentoId: string | null;
  title: string;
  codigoInterno: string | null;
  tipo: string;
  uso: string | null;
  finalidade: string;
  tags: string | null;
  price: number | null;
  rentPrice: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  description: string | null;
  status: string;
  disponivelApartirDe: string | null;
  localChaves: string | null;
  exclusividade: boolean;
  proprietarioNome: string | null;
  proprietarioTelefone: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // So vem preenchido quando carregado via GET /imoveis/:id
  photos?: ImovelPhoto[];
  // Preenchido apenas por GET /imoveis (1a foto, para a visao Cards do Catalogo)
  coverPhotoUrl: string | null;
}

export interface Empreendimento {
  id: string;
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description: string | null;
  createdAt: string;
}

export type FinalidadeFilter = "all" | "venda" | "aluguel" | "ambos";
export type CatalogLayout = "cards" | "lista";
export type ImoveisView = "catalogo" | "espelho";

interface ImovelDetailPanelState {
  isOpen: boolean;
  imovel: Imovel | null;
}

interface ImoveisState {
  imoveis: Imovel[];
  empreendimentos: Empreendimento[];
  isLoading: boolean;

  activeView: ImoveisView;
  catalogLayout: CatalogLayout;

  busca: string;
  finalidadeFilter: FinalidadeFilter;
  statusFilter: string; // "all" ou um dos STATUS_OPTIONS
  empreendimentoFilter: string; // "all" ou o id do empreendimento

  espelhoEmpreendimentoId: string | null;

  imovelDetailPanel: ImovelDetailPanelState;
  imovelFormModalOpen: boolean;
  empreendimentoFormModalOpen: boolean;

  setImoveis: (imoveis: Imovel[]) => void;
  setEmpreendimentos: (empreendimentos: Empreendimento[]) => void;
  setLoading: (isLoading: boolean) => void;

  setActiveView: (view: ImoveisView) => void;
  setCatalogLayout: (layout: CatalogLayout) => void;

  setBusca: (busca: string) => void;
  setFinalidadeFilter: (filter: FinalidadeFilter) => void;
  setStatusFilter: (filter: string) => void;
  setEmpreendimentoFilter: (filter: string) => void;
  hasActiveFilters: () => boolean;

  setEspelhoEmpreendimentoId: (id: string | null) => void;

  openImovelDetailPanel: (imovel: Imovel) => void;
  closeImovelDetailPanel: () => void;

  openImovelFormModal: () => void;
  closeImovelFormModal: () => void;

  openEmpreendimentoFormModal: () => void;
  closeEmpreendimentoFormModal: () => void;

  addImovel: (imovel: Imovel) => void;
  updateImovelInPlace: (imovel: Imovel) => void;

  addEmpreendimento: (empreendimento: Empreendimento) => void;
}

export const useImoveisStore = create<ImoveisState>((set, get) => ({
  imoveis: [],
  empreendimentos: [],
  isLoading: false,

  activeView: "catalogo",
  catalogLayout: "cards",

  busca: "",
  finalidadeFilter: "all",
  statusFilter: "all",
  empreendimentoFilter: "all",

  espelhoEmpreendimentoId: null,

  imovelDetailPanel: { isOpen: false, imovel: null },
  imovelFormModalOpen: false,
  empreendimentoFormModalOpen: false,

  setImoveis: (imoveis) => set({ imoveis }),
  setEmpreendimentos: (empreendimentos) => set({ empreendimentos }),
  setLoading: (isLoading) => set({ isLoading }),

  setActiveView: (activeView) => set({ activeView }),
  setCatalogLayout: (catalogLayout) => set({ catalogLayout }),

  setBusca: (busca) => set({ busca }),
  setFinalidadeFilter: (finalidadeFilter) => set({ finalidadeFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setEmpreendimentoFilter: (empreendimentoFilter) => set({ empreendimentoFilter }),
  hasActiveFilters: () => {
    const { busca, finalidadeFilter, statusFilter, empreendimentoFilter } = get();
    return (
      busca.trim() !== "" ||
      finalidadeFilter !== "all" ||
      statusFilter !== "all" ||
      empreendimentoFilter !== "all"
    );
  },

  setEspelhoEmpreendimentoId: (espelhoEmpreendimentoId) => set({ espelhoEmpreendimentoId }),

  openImovelDetailPanel: (imovel) => set({ imovelDetailPanel: { isOpen: true, imovel } }),
  closeImovelDetailPanel: () => set({ imovelDetailPanel: { isOpen: false, imovel: null } }),

  openImovelFormModal: () => set({ imovelFormModalOpen: true }),
  closeImovelFormModal: () => set({ imovelFormModalOpen: false }),

  openEmpreendimentoFormModal: () => set({ empreendimentoFormModalOpen: true }),
  closeEmpreendimentoFormModal: () => set({ empreendimentoFormModalOpen: false }),

  addImovel: (imovel) => set({ imoveis: [imovel, ...get().imoveis] }),

  updateImovelInPlace: (imovel) => {
    set({
      imoveis: get().imoveis.map((i) => (i.id === imovel.id ? { ...i, ...imovel } : i)),
      imovelDetailPanel:
        get().imovelDetailPanel.imovel?.id === imovel.id
          ? { isOpen: true, imovel: { ...get().imovelDetailPanel.imovel, ...imovel } }
          : get().imovelDetailPanel,
    });
  },

  addEmpreendimento: (empreendimento) =>
    set({ empreendimentos: [empreendimento, ...get().empreendimentos] }),
}));
