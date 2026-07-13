// src/features/atendimento/store/useAtendimentoStore.ts
import { create } from "zustand";

export interface Atendimento {
  id: string;
  tenantId: string;
  whatsappSessionId: string;
  remoteJid: string;
  phoneNumber: string;
  filaId: string | null;
  filaNome: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  motivoFechamento: string | null;
  urgente: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Fila {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
  usuarioIds: string[];
}

export interface AtendimentoEvento {
  id: string;
  atendimentoId: string;
  tipo: string;
  userId: string | null;
  userName: string | null;
  detalhe: string | null;
  createdAt: string;
}

export interface AtendimentoMensagem {
  id: string;
  direction: "IN" | "OUT";
  body: string;
  timestamp: string;
  remoteJid: string | null;
}

interface AtendimentoState {
  atendimentos: Atendimento[];
  filas: Fila[];
  selectedAtendimentoId: string | null;
  eventos: AtendimentoEvento[];
  mensagens: AtendimentoMensagem[];
  isLoadingList: boolean;
  isLoadingDetail: boolean;

  setAtendimentos: (atendimentos: Atendimento[]) => void;
  setFilas: (filas: Fila[]) => void;
  updateAtendimentoInPlace: (atendimento: Atendimento) => void;
  setSelectedAtendimentoId: (id: string | null) => void;
  setDetail: (eventos: AtendimentoEvento[], mensagens: AtendimentoMensagem[]) => void;
  setLoadingList: (isLoading: boolean) => void;
  setLoadingDetail: (isLoading: boolean) => void;
}

export const useAtendimentoStore = create<AtendimentoState>((set, get) => ({
  atendimentos: [],
  filas: [],
  selectedAtendimentoId: null,
  eventos: [],
  mensagens: [],
  isLoadingList: false,
  isLoadingDetail: false,

  setAtendimentos: (atendimentos) => set({ atendimentos }),
  setFilas: (filas) => set({ filas }),
  updateAtendimentoInPlace: (atendimento) =>
    set({
      atendimentos: get().atendimentos.map((a) => (a.id === atendimento.id ? atendimento : a)),
    }),
  setSelectedAtendimentoId: (id) => set({ selectedAtendimentoId: id }),
  setDetail: (eventos, mensagens) => set({ eventos, mensagens }),
  setLoadingList: (isLoading) => set({ isLoadingList: isLoading }),
  setLoadingDetail: (isLoading) => set({ isLoadingDetail: isLoading }),
}));
