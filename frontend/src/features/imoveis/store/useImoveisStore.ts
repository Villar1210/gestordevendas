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

export interface Proprietario {
  id: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  createdAt: string;
  // So vem preenchido via GET /proprietarios
  imoveisVinculados?: number;
}

export interface InquilinoComprador {
  id: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  profissao: string | null;
  rendaDeclarada: number | null;
  statusAnaliseCredito: string;
  observacoesAnalise: string | null;
  createdAt: string;
}

export interface InquilinoDocumento {
  id: string;
  inquilinoId: string;
  tipo: string;
  url: string;
  nomeArquivo: string;
  createdAt: string;
}

export interface Contrato {
  id: string;
  imovelId: string;
  proprietarioId: string;
  inquilinoCompradorId: string;
  tipo: string;
  valor: number;
  dataInicio: string;
  dataFim: string | null;
  diaVencimento: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LancamentoFinanceiro {
  id: string;
  contratoId: string | null;
  tipo: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: string;
  pagoEm: string | null;
  descricao: string | null;
  createdAt: string;
}

export type FinalidadeFilter = "all" | "venda" | "aluguel" | "ambos";
export type CatalogLayout = "cards" | "lista";
export type ImoveisView =
  | "catalogo"
  | "espelho"
  | "proprietarios"
  | "contratos"
  | "financeiro"
  | "inquilinos";

interface ImovelDetailPanelState {
  isOpen: boolean;
  imovel: Imovel | null;
}

interface InquilinoDetailPanelState {
  isOpen: boolean;
  inquilino: InquilinoComprador | null;
}

interface ImoveisState {
  imoveis: Imovel[];
  empreendimentos: Empreendimento[];
  proprietarios: Proprietario[];
  inquilinosCompradores: InquilinoComprador[];
  contratos: Contrato[];
  lancamentos: LancamentoFinanceiro[];
  isLoading: boolean;

  activeView: ImoveisView;
  catalogLayout: CatalogLayout;

  busca: string;
  finalidadeFilter: FinalidadeFilter;
  statusFilter: string; // "all" ou um dos STATUS_OPTIONS
  empreendimentoFilter: string; // "all" ou o id do empreendimento

  espelhoEmpreendimentoId: string | null;

  imovelDetailPanel: ImovelDetailPanelState;
  inquilinoDetailPanel: InquilinoDetailPanelState;
  imovelFormModalOpen: boolean;
  empreendimentoFormModalOpen: boolean;
  proprietarioFormModalOpen: boolean;
  contratoFormModalOpen: boolean;
  lancamentoFormModalOpen: boolean;

  setImoveis: (imoveis: Imovel[]) => void;
  setEmpreendimentos: (empreendimentos: Empreendimento[]) => void;
  setProprietarios: (proprietarios: Proprietario[]) => void;
  setInquilinosCompradores: (inquilinosCompradores: InquilinoComprador[]) => void;
  setContratos: (contratos: Contrato[]) => void;
  setLancamentos: (lancamentos: LancamentoFinanceiro[]) => void;
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

  openInquilinoDetailPanel: (inquilino: InquilinoComprador) => void;
  closeInquilinoDetailPanel: () => void;

  openImovelFormModal: () => void;
  closeImovelFormModal: () => void;

  openEmpreendimentoFormModal: () => void;
  closeEmpreendimentoFormModal: () => void;

  openProprietarioFormModal: () => void;
  closeProprietarioFormModal: () => void;

  openContratoFormModal: () => void;
  closeContratoFormModal: () => void;

  openLancamentoFormModal: () => void;
  closeLancamentoFormModal: () => void;

  addImovel: (imovel: Imovel) => void;
  updateImovelInPlace: (imovel: Imovel) => void;

  addEmpreendimento: (empreendimento: Empreendimento) => void;

  addProprietario: (proprietario: Proprietario) => void;
  updateProprietarioInPlace: (proprietario: Proprietario) => void;

  addInquilinoComprador: (inquilinoComprador: InquilinoComprador) => void;
  updateInquilinoCompradorInPlace: (inquilinoComprador: InquilinoComprador) => void;

  addContrato: (contrato: Contrato) => void;
  updateContratoInPlace: (contrato: Contrato) => void;

  addLancamento: (lancamento: LancamentoFinanceiro) => void;
  updateLancamentoInPlace: (lancamento: LancamentoFinanceiro) => void;
}

export const useImoveisStore = create<ImoveisState>((set, get) => ({
  imoveis: [],
  empreendimentos: [],
  proprietarios: [],
  inquilinosCompradores: [],
  contratos: [],
  lancamentos: [],
  isLoading: false,

  activeView: "catalogo",
  catalogLayout: "cards",

  busca: "",
  finalidadeFilter: "all",
  statusFilter: "all",
  empreendimentoFilter: "all",

  espelhoEmpreendimentoId: null,

  imovelDetailPanel: { isOpen: false, imovel: null },
  inquilinoDetailPanel: { isOpen: false, inquilino: null },
  imovelFormModalOpen: false,
  empreendimentoFormModalOpen: false,
  proprietarioFormModalOpen: false,
  contratoFormModalOpen: false,
  lancamentoFormModalOpen: false,

  setImoveis: (imoveis) => set({ imoveis }),
  setEmpreendimentos: (empreendimentos) => set({ empreendimentos }),
  setProprietarios: (proprietarios) => set({ proprietarios }),
  setInquilinosCompradores: (inquilinosCompradores) => set({ inquilinosCompradores }),
  setContratos: (contratos) => set({ contratos }),
  setLancamentos: (lancamentos) => set({ lancamentos }),
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

  openInquilinoDetailPanel: (inquilino) =>
    set({ inquilinoDetailPanel: { isOpen: true, inquilino } }),
  closeInquilinoDetailPanel: () =>
    set({ inquilinoDetailPanel: { isOpen: false, inquilino: null } }),

  openImovelFormModal: () => set({ imovelFormModalOpen: true }),
  closeImovelFormModal: () => set({ imovelFormModalOpen: false }),

  openEmpreendimentoFormModal: () => set({ empreendimentoFormModalOpen: true }),
  closeEmpreendimentoFormModal: () => set({ empreendimentoFormModalOpen: false }),

  openProprietarioFormModal: () => set({ proprietarioFormModalOpen: true }),
  closeProprietarioFormModal: () => set({ proprietarioFormModalOpen: false }),

  openContratoFormModal: () => set({ contratoFormModalOpen: true }),
  closeContratoFormModal: () => set({ contratoFormModalOpen: false }),

  openLancamentoFormModal: () => set({ lancamentoFormModalOpen: true }),
  closeLancamentoFormModal: () => set({ lancamentoFormModalOpen: false }),

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

  addProprietario: (proprietario) =>
    set({ proprietarios: [proprietario, ...get().proprietarios] }),

  updateProprietarioInPlace: (proprietario) =>
    set({
      proprietarios: get().proprietarios.map((p) =>
        p.id === proprietario.id ? { ...p, ...proprietario } : p,
      ),
    }),

  addInquilinoComprador: (inquilinoComprador) =>
    set({ inquilinosCompradores: [inquilinoComprador, ...get().inquilinosCompradores] }),

  updateInquilinoCompradorInPlace: (inquilinoComprador) =>
    set({
      inquilinosCompradores: get().inquilinosCompradores.map((i) =>
        i.id === inquilinoComprador.id ? { ...i, ...inquilinoComprador } : i,
      ),
      inquilinoDetailPanel:
        get().inquilinoDetailPanel.inquilino?.id === inquilinoComprador.id
          ? {
              isOpen: true,
              inquilino: { ...get().inquilinoDetailPanel.inquilino, ...inquilinoComprador },
            }
          : get().inquilinoDetailPanel,
    }),

  addContrato: (contrato) => set({ contratos: [contrato, ...get().contratos] }),

  updateContratoInPlace: (contrato) =>
    set({
      contratos: get().contratos.map((c) => (c.id === contrato.id ? { ...c, ...contrato } : c)),
    }),

  addLancamento: (lancamento) => set({ lancamentos: [lancamento, ...get().lancamentos] }),

  updateLancamentoInPlace: (lancamento) =>
    set({
      lancamentos: get().lancamentos.map((l) =>
        l.id === lancamento.id ? { ...l, ...lancamento } : l,
      ),
    }),
}));
