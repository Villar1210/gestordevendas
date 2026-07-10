// src/modules/edoc/domain/repositories/signature-envelope-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface SignatureEnvelopeRecord {
  id: string;
  tenantId: string;
  title: string;
  status: string;
  documentUrl: string;
  documentHash: string;
  createdByUserId: string;
  createdAt: Date;
  completedAt: Date | null;
  signedDocumentUrl: string | null;
}

export interface SignatureEnvelopeWithCount extends SignatureEnvelopeRecord {
  recipientsCount: number;
}

export interface ISignatureEnvelopeRepository {
  create(input: {
    tenantId: string;
    title: string;
    documentUrl: string;
    documentHash: string;
    createdByUserId: string;
  }): Promise<SignatureEnvelopeRecord>;
  findById(id: string): Promise<SignatureEnvelopeRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<SignatureEnvelopeRecord | null>;
  findAllByTenant(tenantId: string): Promise<SignatureEnvelopeWithCount[]>;
  updateStatus(id: string, status: string): Promise<SignatureEnvelopeRecord>;
  // Operacao atomica (transaction): marca o envelope como "concluido" e
  // registra o evento "concluido" numa unica escrita - ver
  // PrismaSignatureEnvelopeRepository.
  completeWithEvent(id: string): Promise<SignatureEnvelopeRecord>;
  // Chamado pelo GenerateSignedPdfUseCase apos gerar o PDF final - fora da
  // transaction acima de proposito (I/O de arquivo nao deve segurar lock
  // de banco, ver CLAUDE.md).
  updateSignedDocumentUrl(id: string, signedDocumentUrl: string): Promise<void>;
}
