// src/app/dashboard/inicio/page.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckSquare, Kanban, MessageCircle, Inbox, CalendarClock, Headset } from "lucide-react";
import { useMeuDashboardStore } from "@/features/dashboard-corretor/store/useMeuDashboardStore";
import { useMeuDashboardIntegration } from "@/features/dashboard-corretor/hooks/useMeuDashboardIntegration";
import { getActivityTypeOption } from "@/core/constants/activityTypes";
import { getOrigemBadgeOption } from "@/features/dashboard-corretor/constants";
import { ProximaAtividadeBadge } from "@/features/kanban/components/ProximaAtividadeBadge";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

// Poll simples (mesmo padrao ja usado em /dashboard/atendimento) - sem
// websocket neste modulo ainda.
const POLL_INTERVAL_MS = 60_000;

export default function DashboardInicioPage() {
  const isLoading = useMeuDashboardStore((state) => state.isLoading);
  const leadsPorEstagio = useMeuDashboardStore((state) => state.leadsPorEstagio);
  const atividadesHoje = useMeuDashboardStore((state) => state.atividadesHoje);
  const ultimosLeads = useMeuDashboardStore((state) => state.ultimosLeads);
  const atendimentosAtivos = useMeuDashboardStore((state) => state.atendimentosAtivos);
  const { loadDashboard, handleToggleActivityDone, loadAtendimentosAtivos } =
    useMeuDashboardIntegration();
  const hasInitialized = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadDashboard();
    loadAtendimentosAtivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // silent=true: atualizacao em segundo plano, nao aciona o spinner de
      // carregamento (ver comentario em useMeuDashboardIntegration).
      loadDashboard(true);
      loadAtendimentosAtivos();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboard]);

  function goToCardNoKanban(pipelineId: string, cardId: string) {
    router.push(`/dashboard/kanban?pipelineId=${pipelineId}&cardId=${cardId}`);
  }

  const totalLeads = leadsPorEstagio.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Inicio</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/whatsapp"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Link>
          <Link
            href="/dashboard/kanban"
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Kanban className="h-4 w-4" /> Kanban
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm">Carregando...</p>
        </div>
      ) : (
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          {/* Resumo dos leads por estagio */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">
              Meus leads por etapa {totalLeads > 0 && `(${totalLeads})`}
            </h2>
            {leadsPorEstagio.length === 0 ? (
              <p className="text-sm text-slate-400">
                Voce ainda nao tem nenhum lead atribuido. Assuma um na Caixa de Entrada do Kanban.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {leadsPorEstagio.map((stage) => (
                  <div
                    key={stage.stageId}
                    className="min-w-[140px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-2xl font-semibold text-blue-700">{stage.count}</p>
                    <p className="text-xs text-slate-500">{stage.stageName}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Atividades de hoje */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CalendarClock className="h-4 w-4 text-slate-400" /> Atividades de hoje
            </h2>
            {atividadesHoje.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma atividade pendente para hoje.</p>
            ) : (
              <div className="space-y-2">
                {atividadesHoje.map((activity) => {
                  const typeInfo = getActivityTypeOption(activity.type);
                  const Icon = typeInfo?.icon ?? CheckSquare;
                  return (
                    <div
                      key={activity.id}
                      onClick={() => goToCardNoKanban(activity.cardPipelineId, activity.cardId)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <input
                        type="checkbox"
                        checked={activity.done}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleToggleActivityDone(activity.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">
                          {typeInfo?.label ?? activity.type}
                          {activity.subject ? ` - ${activity.subject}` : ""}
                        </p>
                        <p className="truncate text-xs text-slate-400">{activity.cardTitle}</p>
                      </div>
                      {activity.scheduledAt && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {dateTimeFormatter.format(new Date(activity.scheduledAt))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Ultimos leads recebidos */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Inbox className="h-4 w-4 text-slate-400" /> Ultimos leads recebidos
            </h2>
            {ultimosLeads.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum lead recebido ainda.</p>
            ) : (
              <div className="space-y-2">
                {ultimosLeads.map((lead) => {
                  const origemBadge = getOrigemBadgeOption(lead.origem);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => goToCardNoKanban(lead.pipelineId, lead.id)}
                      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{lead.title}</p>
                          <p className="text-xs text-slate-400">
                            {lead.stageName ?? "Caixa de Entrada"} -{" "}
                            {dateFormatter.format(new Date(lead.createdAt))}
                          </p>
                        </div>
                        {origemBadge && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${origemBadge.className}`}
                          >
                            {origemBadge.label}
                          </span>
                        )}
                      </div>
                      {lead.proximaAtividade && (
                        <ProximaAtividadeBadge proximaAtividade={lead.proximaAtividade} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Carga de trabalho na Central de Atendimento - modulo separado
              do Kanban (ver investigacao do handoff VIVI -> Corretor);
              sempre escopado ao proprio usuario logado, mesmo padrao das
              secoes acima. */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Headset className="h-4 w-4 text-slate-400" /> Central de Atendimento
            </h2>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-[140px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-semibold text-blue-700">
                  {atendimentosAtivos ?? "-"}
                </p>
                <p className="text-xs text-slate-500">Atendimentos ativos</p>
              </div>
              <Link
                href="/dashboard/atendimento"
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Ir para Central de Atendimento
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
