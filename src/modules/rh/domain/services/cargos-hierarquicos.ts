// src/modules/rh/domain/services/cargos-hierarquicos.ts
// Camada de DOMINIO: funcoes/constantes puras, sem Prisma/NestJS.
// Unico lugar de verdade dos cargos hierarquicos validos - usado tanto na
// aprovacao de cadastro (AprovarCadastroUseCase) quanto na tela de gestao
// de Permissoes/Cargos do Painel Administrativo (UpdateUserCargoUseCase).
export const VALID_CARGOS_HIERARQUICOS = [
  'diretor',
  'superintendente',
  'gerente',
  'coordenador',
  'corretor',
];

export function isValidCargoHierarquico(cargo: string): boolean {
  return VALID_CARGOS_HIERARQUICOS.includes(cargo);
}

// So estes 2 perfis usam cargoHierarquico/superiorId - "Corretor Parceiro"
// e autonomo (fora da hierarquia interna da imobiliaria), "Cliente"
// obviamente tambem nao participa.
export const ROLES_COM_HIERARQUIA = ['Corretor', 'Imobiliaria Parceira'];

export function temHierarquia(roleName: string): boolean {
  return ROLES_COM_HIERARQUIA.includes(roleName);
}
