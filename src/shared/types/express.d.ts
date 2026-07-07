// src/shared/types/express.d.ts
// Ensina o TypeScript sobre o formato do usuario injetado pelo JwtStrategy
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

// O @types/passport ja declara `Request.user?: Express.User`.
// Em vez de reescrever essa propriedade (o que gera conflito de tipos),
// enriquecemos a interface Express.User vazia com os campos do nosso payload.
declare global {
  namespace Express {
    export interface User extends AuthenticatedUser {}
  }
}
