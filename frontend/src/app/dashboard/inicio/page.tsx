// src/app/dashboard/inicio/page.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, CheckSquare, Kanban, MessageCircle, Inbox, CalendarClock } from "lucide-react";
import { useMeuDashboardStore } from "@/features/dashboard-corretor/store/useMeuDashboardStore";
import { useMeuDashboardIntegration } from "@/features/dashboard-corretor/hooks/useMeuDashboardIntegration";
import { getActivityTypeOption } from "@/core/constants/activityTypes";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

// Rotula a origem do lead so quando ela veio de automacao ("manual" - o
// caso mais comum, "+ Novo Negocio" do proprio corretor - fica sem rotulo).
// Diferenciacao visual mais rica (cor/icone) fica para uma fatia futura -
// ver PROGRESS.md "Dashboard do Corretor".
const ORIGEM_LABELS: Record<string, string> = {
  roleta_online: "Roleta",
  vivi_repique: "VIVI",
  webhook: "Webhook",
};

export default function DashboardInicioPage() {
  const isLoading = useMeuDashboardStore((state) => state.isLoading);
  const leadsPorEstagio = useMeuDashboardStore((state) => state.leadsPorEstagio);
  const atividadesHoje = useMeuDashboardStore((state) => state.atividadesHoje);
  const ultimosLeads = useMeuDashboardStore((state) => state.ultimosLeads);
  const { loadDashboard, handleToggleActivityDone } = useMeuDashboardIntegration();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={activity.done}
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
                {ultimosLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{lead.title}</p>
                      <p className="text-xs text-slate-400">
                        {lead.stageName ?? "Caixa de Entrada"} -{" "}
                        {dateFormatter.format(new Date(lead.createdAt))}
                      </p>
                    </div>
                    {ORIGEM_LABELS[lead.origem] && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {ORIGEM_LABELS[lead.origem]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
