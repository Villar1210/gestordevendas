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
  const setAtendimentosAtivos = useMeuDashboardStore((state) => state.setAtendimentosAtivos);

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

  // Carga de trabalho na Central de Atendimento - modulo separado do
  // Kanban (ver investigacao: GetMeuDashboardUseCase e do modulo
  // vendas_kanban e nao conhece Atendimento). Em vez de acoplar os dois
  // modulos no backend, reaproveita o endpoint GET /atendimentos que ja
  // aceita ownerId+status como filtro - so busca o proprio id via /auth/me
  // primeiro (mesmo padrao ja usado em /dashboard/atendimento). Falha
  // silenciosa: este card e um extra, nunca deve quebrar o resto do
  // dashboard se o modulo de atendimento tiver algum problema.
  const loadAtendimentosAtivos = useCallback(async () => {
    try {
      const me = await apiRequest<{ id: string }>("/auth/me");
      const atendimentos = await apiRequest<{ id: string }[]>(
        `/atendimentos?ownerId=${me.id}&status=em_atendimento`,
      );
      setAtendimentosAtivos(atendimentos.length);
    } catch {
      // silencioso - ver comentario acima.
    }
  }, [setAtendimentosAtivos]);

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

  return { loadDashboard, handleToggleActivityDone, loadAtendimentosAtivos };
}
