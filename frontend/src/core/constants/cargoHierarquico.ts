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
