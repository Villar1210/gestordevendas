// src/modules/gestao_imobiliaria/domain/repositories/inquilino-comprador-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

// Fatia 5 (Moradores/Inquilinos): analise de credito (profissao/renda/
// status/observacoes) e documentos anexados (InquilinoDocumento).
export interface InquilinoCompradorRecord {
  id: string;
  tenantId: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string;
  email: string | null;
  profissao: string | null;
  rendaDeclarada: number | null;
  statusAnaliseCredito: string;
  observacoesAnalise: string | null;
  createdAt: Date;
}

export interface InquilinoCompradorWritableFields {
  nome?: string;
  cpfCnpj?: string | null;
  telefone?: string;
  email?: string | null;
  profissao?: string | null;
  rendaDeclarada?: number | null;
  statusAnaliseCredito?: string;
  observacoesAnalise?: string | null;
}

export interface InquilinoDocumentoRecord {
  id: string;
  tenantId: string;
  inquilinoId: string;
  tipo: string;
  url: string;
  nomeArquivo: string;
  createdAt: Date;
}

export interface IInquilinoCompradorRepository {
  create(
    input: InquilinoCompradorWritableFields & {
      tenantId: string;
      nome: string;
      telefone: string;
    },
  ): Promise<InquilinoCompradorRecord>;
  update(id: string, input: InquilinoCompradorWritableFields): Promise<InquilinoCompradorRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<InquilinoCompradorRecord | null>;
  findAllByTenant(tenantId: string): Promise<InquilinoCompradorRecord[]>;

  findDocumentosByInquilino(inquilinoId: string): Promise<InquilinoDocumentoRecord[]>;
  addDocumento(input: {
    tenantId: string;
    inquilinoId: string;
    tipo: string;
    url: string;
    nomeArquivo: string;
  }): Promise<InquilinoDocumentoRecord>;
  findDocumentoByIdAndTenant(
    documentoId: string,
    tenantId: string,
  ): Promise<InquilinoDocumentoRecord | null>;
  deleteDocumento(documentoId: string): Promise<void>;
}
