// src/shared/types/express.d.ts
// Ensina o TypeScript sobre o formato do usuario injetado pelo JwtStrategy
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
  // Sistema de permissoes por cargo hierarquico (RBAC) - null se o token
  // foi emitido antes desta mudanca (usuario ainda nao relogou) ou se o
  // usuario nao tem cargo definido - tratado como fallback seguro
  // ('proprio'/podeExcluir=true) em cargo-escopo.ts, nunca quebra.
  cargo: string | null;
  // Modulo Plantao/Stand: stand fixo do Coordenador (null para outros
  // cargos, ou Coordenador ainda sem stand atribuido) - usado pelo escopo
  // 'plantao' do RBAC (ver cargo-escopo.ts).
  standId: string | null;
}

// O @types/passport ja declara `Request.user?: Express.User`.
// Em vez de reescrever essa propriedade (o que gera conflito de tipos),
// enriquecemos a interface Express.User vazia com os campos do nosso payload.
declare global {
  namespace Express {
    export interface User extends AuthenticatedUser {}
  }
}
