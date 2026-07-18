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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<MeuDashboardResponse>("/pipelines/meu-dashboard");
      setDashboard(data);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setDashboard]);

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
