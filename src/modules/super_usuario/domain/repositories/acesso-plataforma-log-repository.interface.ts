// src/modules/super_usuario/domain/repositories/acesso-plataforma-log-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface AcessoPlataformaLogRecord {
  id: string;
  superUsuarioId: string;
  tenantId: string | null;
  tenantNome: string;
  createdAt: Date;
}

export interface IAcessoPlataformaLogRepository {
  create(input: {
    superUsuarioId: string;
    tenantId: string;
    tenantNome: string;
  }): Promise<AcessoPlataformaLogRecord>;
}
