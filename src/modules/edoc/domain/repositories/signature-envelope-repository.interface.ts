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
  // Assunto/mensagem customizaveis do e-mail de convite (Fatia 4) - nulos
  // se nao customizado, SendEnvelopeUseCase aplica o template padrao nesse caso.
  emailSubject: string | null;
  emailMessage: string | null;
}

export interface SignatureEnvelopeWithCount extends SignatureEnvelopeRecord {
  recipientsCount: number;
}

// Filtros de listagem (Fatia 4): status exato e busca por titulo (case-
// insensitive, "contains"). Ambos opcionais - sem eles, comportamento
// identico a antes (lista tudo do tenant).
export interface ListEnvelopesFilter {
  status?: string;
  search?: string;
}

export interface EnvelopeStats {
  total: number;
  rascunho: number;
  aguardando_assinaturas: number;
  concluido: number;
  cancelado: number;
}

export interface ISignatureEnvelopeRepository {
  create(input: {
    tenantId: string;
    title: string;
    documentUrl: string;
    documentHash: string;
    createdByUserId: string;
    emailSubject?: string | null;
    emailMessage?: string | null;
  }): Promise<SignatureEnvelopeRecord>;
  findById(id: string): Promise<SignatureEnvelopeRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<SignatureEnvelopeRecord | null>;
  findAllByTenant(
    tenantId: string,
    filter?: ListEnvelopesFilter,
  ): Promise<SignatureEnvelopeWithCount[]>;
  countByTenantGroupedByStatus(tenantId: string): Promise<EnvelopeStats>;
  updateStatus(id: string, status: string): Promise<SignatureEnvelopeRecord>;
  // Usado por UpdateEnvelopeDraftUseCase (Fatia 4) - so chamado quando o
  // envelope ainda esta "rascunho" (a checagem de status vive no use case,
  // nao aqui no repositorio).
  update(
    id: string,
    data: Partial<{
      title: string;
      documentUrl: string;
      documentHash: string;
      emailSubject: string | null;
      emailMessage: string | null;
    }>,
  ): Promise<SignatureEnvelopeRecord>;
  // Operacao atomica (transaction): marca o envelope como "concluido" e
  // registra o evento "concluido" numa unica escrita - ver
  // PrismaSignatureEnvelopeRepository.
  completeWithEvent(id: string): Promise<SignatureEnvelopeRecord>;
  // Chamado pelo GenerateSignedPdfUseCase apos gerar o PDF final - fora da
  // transaction acima de proposito (I/O de arquivo nao deve segurar lock
  // de banco, ver CLAUDE.md).
  updateSignedDocumentUrl(id: string, signedDocumentUrl: string): Promise<void>;
}
