// src/modules/gestao_imobiliaria/domain/repositories/inquilino-comprador-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

// Entidade enxuta por agora - sera expandida (historico, analise de
// credito) quando a Fatia 5 (Moradores/Inquilinos) for construida formalmente.
export interface InquilinoCompradorRecord {
  id: string;
  tenantId: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  createdAt: Date;
}

export interface InquilinoCompradorWritableFields {
  nome?: string;
  cpfCnpj?: string | null;
  telefone?: string;
  email?: string | null;
}

export interface IInquilinoCompradorRepository {
  create(
    input: InquilinoCompradorWritableFields & {
      tenantId: string;
      nome: string;
      telefone: string;
    },
  ): Promise<InquilinoCompradorRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<InquilinoCompradorRecord | null>;
  findAllByTenant(tenantId: string): Promise<InquilinoCompradorRecord[]>;
}
