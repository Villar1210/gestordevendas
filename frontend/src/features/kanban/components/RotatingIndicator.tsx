// frontend/src/features/kanban/components/RotatingIndicator.tsx
// Indicador visual de "deal parado" (rotting) - mostra alerta quando card
// fica muito tempo sem atividade, com intensidade crescente (amarelo > vermelho)
import { AlertTriangle } from "lucide-react";
import { Card } from "../store/useKanbanStore";

interface RotatingIndicatorProps {
  card: Card;
  diasParaRotting: number;
  ativa: boolean;
}

export function RotatingIndicator({ card, diasParaRotting, ativa }: RotatingIndicatorProps) {
  if (!ativa) return null;

  // Validação 1: ultimaAtividadeEm existe? Se não, usar createdAt como fallback
  const dataParaCalculo = card.ultimaAtividadeEm ?? card.createdAt;

  // Validação 2: data é válida?
  const timestamp = new Date(dataParaCalculo).getTime();
  if (isNaN(timestamp)) {
    console.warn(`[RotatingIndicator] Data inválida para card ${card.id}: ${dataParaCalculo}`);
    return null;
  }

  const diasSemAtividade = Math.floor(
    (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
  );

  if (diasSemAtividade <= diasParaRotting) return null;

  // Segundo nível: crítico em 2x o limite
  const ehCritico = diasSemAtividade > diasParaRotting * 2;

  const bgColor = ehCritico
    ? "bg-red-100 border-red-300 hover:bg-red-200"
    : "bg-amber-100 border-amber-300 hover:bg-amber-200";

  const textColor = ehCritico ? "text-red-700" : "text-amber-700";
  const iconColor = ehCritico ? "text-red-600" : "text-amber-600";
  const badge = ehCritico
    ? `bg-red-600 text-white`
    : `bg-amber-600 text-white`;

  return (
    <div
      className={`rounded-lg border-2 p-2 ${bgColor} mb-2 flex items-start justify-between gap-2`}
      title={`Sem atividade há ${diasSemAtividade} dias`}
    >
      <div className="flex items-start gap-2 flex-1">
        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
        <div>
          <p className={`text-xs font-semibold ${textColor}`}>Deal parado</p>
          <p className={`text-xs ${textColor} opacity-80`}>
            {diasSemAtividade} dias sem atividade
          </p>
        </div>
      </div>
      <span className={`${badge} rounded-full px-2 py-1 text-xs font-bold shrink-0`}>
        {diasSemAtividade}d
      </span>
    </div>
  );
}
