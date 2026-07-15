// src/modules/rh/domain/services/cargos-hierarquicos.ts
// Camada de DOMINIO: funcoes/constantes puras, sem Prisma/NestJS.
// Unico lugar de verdade dos cargos hierarquicos validos - usado tanto na
// aprovacao de cadastro (AprovarCadastroUseCase) quanto na tela de gestao
// de Permissoes/Cargos do Painel Administrativo (UpdateUserCargoUseCase).
// "diretor_regional"/"gerente_regional" adicionados junto com o sistema de
// permissoes por cargo (RBAC) - mesmo escopo de "diretor"/"gerente" no
// mapeamento de permissoes, so uma variacao de titulo (ver
// shared/domain/services/cargo-escopo.ts).
export const VALID_CARGOS_HIERARQUICOS = [
  'diretor',
  'diretor_regional',
  'superintendente',
  'gerente',
  'gerente_regional',
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
