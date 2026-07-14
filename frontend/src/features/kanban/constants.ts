// src/features/kanban/constants.ts
// Espelha domain/services/protected-stages.ts do backend (projetos
// separados, sem compartilhamento de codigo) - so para decidir se
// mostra o lapis/lixeira no cabecalho da coluna. O backend e quem
// realmente bloqueia (400) - isso aqui e so UX, nao seguranca.
export const PROTECTED_STAGE_NAMES = ["Fechamento", "Repique"];

export function isProtectedStageName(name: string): boolean {
  return PROTECTED_STAGE_NAMES.includes(name);
}
