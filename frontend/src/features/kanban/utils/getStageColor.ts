// frontend/src/features/kanban/utils/getStageColor.ts
// Retorna classe Tailwind de cor (border-t-4) para uma stage baseado em proteção e índice.
// Cores são definidas em tailwind.config.ts na chave `stage-{x}`.
// IMPORTANTE: Classes devem ser literais/completas (não interpoladas) para que Tailwind
// possa escaneá-las e gerar o CSS correspondente.

import { Stage } from "../store/useKanbanStore";
import { PROTECTED_STAGE_NAMES, REPIQUE_STAGE_NAME } from "../constants";

const STAGE_BORDER_CLASSES = [
  "border-stage-0",
  "border-stage-1",
  "border-stage-2",
  "border-stage-3",
  "border-stage-4",
];

export function getStageColorClass(stage: Stage, stageIndex: number): string {
  // Estágios protegidos têm cor fixa
  if (stage.name === REPIQUE_STAGE_NAME) {
    return "border-t-4 border-stage-repique";
  }

  if (PROTECTED_STAGE_NAMES.includes(stage.name) && stage.name !== REPIQUE_STAGE_NAME) {
    // "Fechamento" e outros protegidos (não Repique)
    return "border-t-4 border-stage-fechamento";
  }

  // Demais estágios: cor por índice, ciclando pela paleta (classe literal)
  const borderClass = STAGE_BORDER_CLASSES[stageIndex % STAGE_BORDER_CLASSES.length];
  return `border-t-4 ${borderClass}`;
}
