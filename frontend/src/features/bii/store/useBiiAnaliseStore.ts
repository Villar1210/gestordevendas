// Estado da Analise por Endereco: rascunho do formulario, ultimo resultado,
// loading e erro. Fica em Zustand para sobreviver a troca de aba (Painel ->
// Endereco -> Historico -> Endereco nao perde a analise feita).
import { create } from "zustand";
import type { AnaliseEnderecoResponse, PeriodoMeses, RaioMetros, TipoImovelItbi } from "../types-endereco";

export interface AnaliseFormState {
  endereco: string;
  raioMetros: RaioMetros;
  meses: PeriodoMeses;
  tipo: TipoImovelItbi;
  somenteCompraVenda: boolean;
  areaMin: string; // texto do input ("" = sem filtro)
  areaMax: string;
}

export const ANALISE_FORM_PADRAO: AnaliseFormState = {
  endereco: "",
  raioMetros: 1000,
  meses: 12,
  tipo: "residencial",
  somenteCompraVenda: true,
  areaMin: "",
  areaMax: "",
};

interface BiiAnaliseState {
  form: AnaliseFormState;
  resultado: AnaliseEnderecoResponse | null;
  isLoading: boolean;
  erro: string | null;

  setCampo: <K extends keyof AnaliseFormState>(campo: K, valor: AnaliseFormState[K]) => void;
  setResultado: (resultado: AnaliseEnderecoResponse | null) => void;
  setLoading: (isLoading: boolean) => void;
  setErro: (erro: string | null) => void;
}

export const useBiiAnaliseStore = create<BiiAnaliseState>((set) => ({
  form: ANALISE_FORM_PADRAO,
  resultado: null,
  isLoading: false,
  erro: null,

  setCampo: (campo, valor) => set((state) => ({ form: { ...state.form, [campo]: valor } })),
  setResultado: (resultado) => set({ resultado }),
  setLoading: (isLoading) => set({ isLoading }),
  setErro: (erro) => set({ erro }),
}));
