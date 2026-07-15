// src/shared/domain/services/cargo-escopo.ts
// Camada de DOMINIO: funcoes/constantes puras, sem Prisma/NestJS. Sistema
// de permissoes por cargo hierarquico (RBAC) - fica em shared/ (nao dentro
// do modulo rh, que so e dono da ATRIBUICAO do cargo) porque varios
// modulos (vendas_kanban, atendimento, whatsappmarketing) precisam
// consultar isso sem importar o modulo rh inteiro - mesmo raciocinio ja
// usado por dashboard-roles.ts.
//
// Cargo controla QUANTO DADO o usuario ve dentro das telas que o Role dele
// ja acessa (Role continua controlando QUAIS TELAS abrem - RolesGuard,
// inalterado). Administrador sempre "todos"+podeExcluir=true, por bypass
// direto (nao tem cargoHierarquico preenchido). Escopo "equipe" e a arvore
// INTEIRA de subordinados (recursivo - ver GetSubordinadosRecursivosUseCase
// no modulo auth), nao so os diretos.
export type EscopoVisibilidade = 'todos' | 'equipe' | 'proprio';

interface CargoConfig {
  escopo: EscopoVisibilidade;
  podeExcluir: boolean;
}

// "superintendente" existe em VALID_CARGOS_HIERARQUICOS mas nao foi
// mencionado no mapeamento de permissoes pedido - tratado como sinonimo de
// "gerente" (mesmo escopo) em vez de removido, para nao quebrar cadastros
// que ja usem esse valor.
export const CARGO_ESCOPO: Record<string, CargoConfig> = {
  diretor: { escopo: 'todos', podeExcluir: false },
  diretor_regional: { escopo: 'todos', podeExcluir: false },
  gerente: { escopo: 'equipe', podeExcluir: false },
  gerente_regional: { escopo: 'equipe', podeExcluir: false },
  superintendente: { escopo: 'equipe', podeExcluir: false },
  coordenador: { escopo: 'equipe', podeExcluir: false },
  corretor: { escopo: 'proprio', podeExcluir: true },
};

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

// Fallback 'proprio'+podeExcluir=true preserva o comportamento de HOJE
// para quem nao tem cargo definido ainda (Corretor recem-aprovado sem
// cargo atribuido) ou Corretor Parceiro (fora de ROLES_COM_HIERARQUIA,
// nunca ganha cargoHierarquico).
export function resolveEscopo(role: string, cargo: string | null): EscopoVisibilidade {
  if (role === ADMINISTRADOR_ROLE_NAME) return 'todos';
  if (!cargo) return 'proprio';
  return CARGO_ESCOPO[cargo]?.escopo ?? 'proprio';
}

export function podeExcluirRegistroDeNegocio(role: string, cargo: string | null): boolean {
  if (role === ADMINISTRADOR_ROLE_NAME) return true;
  if (!cargo) return true;
  return CARGO_ESCOPO[cargo]?.podeExcluir ?? true;
}
