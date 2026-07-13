// src/modules/atendimento/domain/repositories/fila-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface FilaRecord {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  createdAt: Date;
}

export interface FilaWithUsuarioIds extends FilaRecord {
  usuarioIds: string[];
}

export interface IFilaRepository {
  create(input: { tenantId: string; nome: string; descricao?: string | null }): Promise<FilaRecord>;
  findAllByTenant(tenantId: string): Promise<FilaWithUsuarioIds[]>;
  findByIdAndTenant(id: string, tenantId: string): Promise<FilaRecord | null>;
  findByTenantAndNome(tenantId: string, nome: string): Promise<FilaRecord | null>;
  // Usado por GetOrCreateAtendimentoUseCase para decidir se cria as 3 filas
  // padrao (tenant ainda sem nenhuma fila).
  countByTenant(tenantId: string): Promise<number>;
  // Atendimentos vinculados ficam com filaId=null (onDelete: SetNull no
  // schema) - excluir uma fila nunca apaga atendimentos, so os devolve
  // para "nao classificado".
  deleteById(id: string): Promise<void>;
  addUsuario(filaId: string, userId: string): Promise<void>;
  removeUsuario(filaId: string, userId: string): Promise<void>;
  isUsuarioInFila(filaId: string, userId: string): Promise<boolean>;
  // Ids das filas em que o usuario esta vinculado - usado por
  // ListAtendimentosUseCase para restringir a visibilidade de um
  // agente/Corretor (ve so o que pertence as proprias filas + o que ja
  // assumiu).
  findFilaIdsByUsuario(userId: string): Promise<string[]>;
}
