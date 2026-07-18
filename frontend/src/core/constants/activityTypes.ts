// src/core/constants/activityTypes.ts
// Promovido de features/kanban/components/CardDetailPanel.tsx para core/
// constants (mesma convencao ja usada em dashboardRoles.ts/cargoHierarquico.ts)
// ao ser reaproveitado tambem pelo Dashboard do Corretor
// (features/dashboard-corretor).
import { Phone, Users, Home, CheckSquare, DollarSign, type LucideIcon } from "lucide-react";

export interface ActivityTypeOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const ACTIVITY_TYPE_OPTIONS: ActivityTypeOption[] = [
  { value: "ligacao", label: "Ligacao", icon: Phone },
  { value: "reuniao", label: "Reuniao", icon: Users },
  { value: "visita", label: "Visita", icon: Home },
  { value: "tarefa", label: "Tarefa", icon: CheckSquare },
  { value: "proposta", label: "Proposta", icon: DollarSign },
];

export function getActivityTypeOption(value: string): ActivityTypeOption | undefined {
  return ACTIVITY_TYPE_OPTIONS.find((t) => t.value === value);
}
