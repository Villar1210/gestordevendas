// src/features/dashboard-corretor/hooks/useMeuDashboardIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useMeuDashboardStore,
  LeadPorEstagio,
  AtividadeHoje,
  UltimoLead,
} from "../store/useMeuDashboardStore";

interface MeuDashboardResponse {
  leadsPorEstagio: LeadPorEstagio[];
  atividadesHoje: AtividadeHoje[];
  ultimosLeads: UltimoLead[];
}

export function useMeuDashboardIntegration() {
  const setLoading = useMeuDashboardStore((state) => state.setLoading);
  const setDashboard = useMeuDashboardStore((state) => state.setDashboard);
  const setAtividadeDone = useMeuDashboardStore((state) => state.setAtividadeDone);

  const loadDashboard = useCallback(
    // silent=true (usado pelo poll em segundo plano, ver page.tsx) NAO
    // aciona isLoading - evita trocar a tela inteira por um spinner a cada
    // atualizacao automatica (mesmo padrao ja usado em
    // useAtendimentoIntegration.loadAtendimentoDetail).
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiRequest<MeuDashboardResponse>("/pipelines/meu-dashboard");
        setDashboard(data);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [setLoading, setDashboard],
  );

  const handleToggleActivityDone = useCallback(
    async (activityId: string) => {
      try {
        await apiRequest(`/activities/${activityId}/toggle-done`, { method: "PATCH" });
        setAtividadeDone(activityId, true);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel atualizar a atividade.");
      }
    },
    [setAtividadeDone],
  );

  return { loadDashboard, handleToggleActivityDone };
}
