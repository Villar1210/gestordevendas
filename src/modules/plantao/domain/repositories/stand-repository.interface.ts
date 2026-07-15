// src/modules/plantao/domain/repositories/stand-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface StandRecord {
  id: string;
  tenantId: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStandRepository {
  create(input: { tenantId: string; nome: string; endereco?: string | null }): Promise<StandRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<StandRecord | null>;
  findAllByTenant(tenantId: string): Promise<StandRecord[]>;
  update(
    id: string,
    input: { nome: string; endereco?: string | null; ativo: boolean },
  ): Promise<StandRecord>;
  delete(id: string): Promise<void>;
  // Usados por DeleteStandUseCase para bloquear a exclusao com seguranca -
  // um Stand com escala definida ou Coordenador vinculado nao pode sumir
  // silenciosamente (perderia dado real de escala / desvincularia o
  // Coordenador sem aviso).
  countEscalasByStand(standId: string): Promise<number>;
  countCoordenadoresByStand(standId: string): Promise<number>;
}
