// src/features/kanban/components/ProximaAtividadeBadge.tsx
// Indicador visual de "tem atividade agendada pendente", reaproveitado por
// KanbanCard.tsx e InboxView.tsx - evita ter que abrir o CardDetailPanel so
// pra descobrir que ha uma visita (ou outro tipo de atividade) marcada.
// Generico para qualquer tipo de Activity (nao so "visita") - o schema ja
// trata todos os 5 tipos de forma uniforme (ver activityTypes.ts), uma
// proposta ou tarefa atrasada e tao urgente quanto uma visita perdida.
import { AlertTriangle } from "lucide-react";
import { getActivityTypeOption } from "@/core/constants/activityTypes";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

interface ProximaAtividade {
  type: string;
  subject: string | null;
  scheduledAt: string;
}

interface ProximaAtividadeBadgeProps {
  proximaAtividade: ProximaAtividade;
}

export function ProximaAtividadeBadge({ proximaAtividade }: ProximaAtividadeBadgeProps) {
  const scheduledDate = new Date(proximaAtividade.scheduledAt);
  const atrasada = scheduledDate.getTime() < Date.now();
  const typeOption = getActivityTypeOption(proximaAtividade.type);
  const Icon = atrasada ? AlertTriangle : typeOption?.icon;
  const label = typeOption?.label ?? proximaAtividade.type;
  const dataFormatada = `${dateFormatter.format(scheduledDate)}, ${timeFormatter.format(scheduledDate)}`;

  const style = atrasada
    ? "bg-red-100 text-red-700"
    : "bg-blue-100 text-blue-700";

  return (
    <span
      className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
      title={atrasada ? `${label} atrasada` : label}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label} {dataFormatada}
    </span>
  );
}
