// src/modules/vendas_kanban/domain/repositories/card-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface CardRecord {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  imovelId: string | null;
  title: string;
  value: number;
  position: number;
  origem: string;
  phone: string | null;
  temperatura: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICardRepository {
  create(input: {
    tenantId: string;
    pipelineId: string;
    stageId?: string | null;
    ownerId?: string | null;
    imovelId?: string | null;
    title: string;
    value?: number;
    position: number;
    origem?: string;
    phone?: string | null;
    temperatura?: string | null;
    customFields?: Record<string, unknown>;
  }): Promise<CardRecord>;
  findById(id: string): Promise<CardRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<CardRecord | null>;
  // Retorna ordenado por position (crescente).
  findAllByStage(stageId: string): Promise<CardRecord[]>;
  // Cards de um pipeline ainda sem stageId (Caixa de Entrada), mais antigos primeiro.
  findAllByPipelineInbox(pipelineId: string): Promise<CardRecord[]>;
  updateStageAndPosition(id: string, stageId: string, position: number): Promise<void>;
  // Usado exclusivamente pelo fluxo de "assumir lead": atribui dono e
  // move da Caixa de Entrada para uma stage, em uma unica operacao.
  assignOwnerAndStage(
    id: string,
    input: { ownerId: string; stageId: string; position: number },
  ): Promise<CardRecord>;
  update(
    id: string,
    input: {
      title?: string;
      value?: number;
      phone?: string | null;
      temperatura?: string | null;
      email?: string | null;
      endereco?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      imovelId?: string | null;
      customFields?: Record<string, unknown>;
    },
  ): Promise<CardRecord>;
  delete(id: string): Promise<void>;
}
