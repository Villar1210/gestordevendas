// src/modules/roleta_online/domain/services/permissao-roleta.ts
// Fatia 2 (Sorteio da vez): quem pode apertar "Sortear agora".
// Decisao do Villar: Administrador e quem supervisiona (gerentes, diretores
// e coordenadores). Configurar roletas continua so com o Administrador.
export const CARGOS_QUE_SORTEIAM = [
  'diretor',
  'diretor_regional',
  'superintendente',
  'gerente',
  'gerente_regional',
  'coordenador',
];

export function podeSortear(role: string, cargo: string | null | undefined): boolean {
  if (role === 'Administrador') return true;
  return !!cargo && CARGOS_QUE_SORTEIAM.includes(cargo);
}
