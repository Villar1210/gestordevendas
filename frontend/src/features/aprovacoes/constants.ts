// src/features/aprovacoes/constants.ts
// Espelha os valores aceitos pelo backend (public-signup.dto.ts /
// aprovar-cadastro.dto.ts).

export const CARGO_HIERARQUICO_OPTIONS = [
  { value: "diretor", label: "Diretor" },
  { value: "superintendente", label: "Superintendente" },
  { value: "gerente", label: "Gerente" },
  { value: "coordenador", label: "Coordenador" },
  { value: "corretor", label: "Corretor" },
];

// Roles que ganham os campos extras (cargoHierarquico + superior) na
// aprovacao - ver RhController/AprovarCadastroUseCase.
export const ROLES_COM_HIERARQUIA = ["Corretor", "Imobiliaria Parceira"];

export function getTipoClienteLabel(tipoCliente: string | null): string {
  if (tipoCliente === "comprador") return "Comprador";
  if (tipoCliente === "proprietario") return "Proprietario";
  if (tipoCliente === "ambos") return "Comprador e Proprietario";
  return "-";
}
