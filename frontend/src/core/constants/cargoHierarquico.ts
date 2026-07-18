// src/core/constants/cargoHierarquico.ts
// Espelha src/modules/rh/domain/services/cargos-hierarquicos.ts do
// backend. Usado tanto pelo formulario de aprovacao de cadastro
// (features/aprovacoes) quanto pela aba "Permissoes/Cargos" do Painel
// Administrativo (features/configuracoes) - por isso vive em core/
// constants, nao dentro de uma feature especifica (mesma convencao de
// core/constants/dashboardRoles.ts).
export const CARGO_HIERARQUICO_OPTIONS = [
  { value: "diretor", label: "Diretor" },
  { value: "diretor_regional", label: "Diretor Regional" },
  { value: "superintendente", label: "Superintendente" },
  { value: "gerente", label: "Gerente" },
  { value: "gerente_regional", label: "Gerente Regional" },
  { value: "coordenador", label: "Coordenador" },
  { value: "corretor", label: "Corretor" },
];

// Roles que participam da hierarquia (cargoHierarquico + superior).
export const ROLES_COM_HIERARQUIA = ["Corretor", "Imobiliaria Parceira"];

// Cargos que supervisionam equipe (escopo 'equipe'/'plantao' no RBAC, ver
// cargoEscopo.ts) - usado pelo login/`/` para decidir landing page: quem
// supervisiona equipe continua indo para o Kanban (visao de time), so quem
// NAO supervisiona (cargo "corretor" ou sem cargo definido, mesmo fallback
// ja usado em cargoEscopo.ts) vai para o Dashboard do Corretor
// (/dashboard/inicio) - ver CLAUDE.md/PROGRESS.md.
const CARGOS_SUPERVISORES = [
  "diretor",
  "diretor_regional",
  "superintendente",
  "gerente",
  "gerente_regional",
  "coordenador",
];

export function ehCargoSupervisor(cargo: string | null | undefined): boolean {
  return !!cargo && CARGOS_SUPERVISORES.includes(cargo);
}
