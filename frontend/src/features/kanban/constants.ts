// src/features/kanban/constants.ts
// Espelha domain/services/protected-stages.ts do backend (projetos
// separados, sem compartilhamento de codigo) - so para decidir se
// mostra o lapis/lixeira no cabecalho da coluna. O backend e quem
// realmente bloqueia (400) - isso aqui e so UX, nao seguranca.
export const PROTECTED_STAGE_NAMES = ["Fechamento", "Repique"];
export const REPIQUE_STAGE_NAME = "Repique";

export function isProtectedStageName(name: string): boolean {
  return PROTECTED_STAGE_NAMES.includes(name);
}

// Espelha domain/services/motivo-repique.ts do backend - so a lista de
// opcoes do modal (MotivoRepiqueModal.tsx). O backend valida de novo
// (defesa em profundidade), isso aqui e so UX.
export const MOTIVO_REPIQUE_OPTIONS: { value: string; label: string }[] = [
  { value: "SEM_RESPOSTA_90_DIAS", label: "Sem resposta ha 90+ dias" },
  { value: "RESTRICAO_CPF", label: "Restricao no CPF" },
  { value: "PRECO", label: "Preco (fora do orcamento do lead)" },
  { value: "SEM_PERFIL", label: "Sem perfil para financiamento" },
  { value: "OUTRO", label: "Outro motivo" },
];
