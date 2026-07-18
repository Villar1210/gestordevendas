// src/features/dashboard-corretor/store/useMeuDashboardStore.ts
import { create } from "zustand";

export interface LeadPorEstagio {
  stageId: string;
  stageName: string;
  count: number;
}

export interface AtividadeHoje {
  id: string;
  cardId: string;
  cardPipelineId: string;
  type: string;
  subject: string | null;
  scheduledAt: string | null;
  done: boolean;
  cardTitle: string;
}

export interface UltimoLead {
  id: string;
  pipelineId: string;
  title: string;
  stageId: string | null;
  stageName: string | null;
  origem: string;
  createdAt: string;
}

interface MeuDashboardState {
  isLoading: boolean;
  leadsPorEstagio: LeadPorEstagio[];
  atividadesHoje: AtividadeHoje[];
  ultimosLeads: UltimoLead[];

  setLoading: (isLoading: boolean) => void;
  setDashboard: (data: {
    leadsPorEstagio: LeadPorEstagio[];
    atividadesHoje: AtividadeHoje[];
    ultimosLeads: UltimoLead[];
  }) => void;
  setAtividadeDone: (activityId: string, done: boolean) => void;
}

export const useMeuDashboardStore = create<MeuDashboardState>((set, get) => ({
  isLoading: false,
  leadsPorEstagio: [],
  atividadesHoje: [],
  ultimosLeads: [],

  setLoading: (isLoading) => set({ isLoading }),
  setDashboard: (data) => set({ ...data }),
  // Marcar como feita so some da lista de "hoje pendente" - reflete o mesmo
  // filtro (done=false) que o backend ja aplica em findPendingTodayByOwner.
  setAtividadeDone: (activityId, done) =>
    set({
      atividadesHoje: done
        ? get().atividadesHoje.filter((a) => a.id !== activityId)
        : get().atividadesHoje,
    }),
}));
