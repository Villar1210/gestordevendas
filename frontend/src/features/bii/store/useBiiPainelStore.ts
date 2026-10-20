// src/features/bii/store/useBiiPainelStore.ts
// Estado do Painel de Vendas do BII: filtros em edicao (rascunho), filtros
// aplicados (os que geraram os dados na tela), dados, loading e erro.
import { create } from "zustand";
import { FILTROS_PADRAO } from "../constants";
import type { PainelFiltrosState, PainelVendasResponse } from "../types";

interface BiiPainelState {
  filtros: PainelFiltrosState;
  filtrosAplicados: PainelFiltrosState;
  dados: PainelVendasResponse | null;
  isLoading: boolean;
  erro: string | null;

  setFiltro: <K extends keyof PainelFiltrosState>(campo: K, valor: PainelFiltrosState[K]) => void;
  setFiltrosAplicados: (filtros: PainelFiltrosState) => void;
  resetFiltros: () => void;
  setDados: (dados: PainelVendasResponse) => void;
  setLoading: (isLoading: boolean) => void;
  setErro: (erro: string | null) => void;
}

export const useBiiPainelStore = create<BiiPainelState>((set) => ({
  filtros: FILTROS_PADRAO,
  filtrosAplicados: FILTROS_PADRAO,
  dados: null,
  isLoading: false,
  erro: null,

  setFiltro: (campo, valor) => set((state) => ({ filtros: { ...state.filtros, [campo]: valor } })),
  setFiltrosAplicados: (filtrosAplicados) => set({ filtrosAplicados, filtros: filtrosAplicados }),
  resetFiltros: () => set({ filtros: FILTROS_PADRAO }),
  setDados: (dados) =>
    set((state) => ({
      dados,
      // Pipeline vazio = "padrao do backend": depois da resposta, mostra no
      // seletor qual pipeline foi realmente usado.
      filtros:
        !state.filtros.pipelineId && dados.pipelineId
          ? { ...state.filtros, pipelineId: dados.pipelineId }
          : state.filtros,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setErro: (erro) => set({ erro }),
}));
