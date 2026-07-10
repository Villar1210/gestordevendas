// src/modules/edoc/domain/repositories/signature-event-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export type SignatureEventType =
  | 'criado'
  | 'enviado'
  | 'visualizado'
  | 'assinado'
  | 'concluido'
  | 'cancelado';

export interface SignatureEventRecord {
  id: string;
  envelopeId: string;
  recipientId: string | null;
  type: SignatureEventType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ISignatureEventRepository {
  create(input: {
    envelopeId: string;
    recipientId?: string | null;
    type: SignatureEventType;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<SignatureEventRecord>;
  existsByRecipientAndType(recipientId: string, type: SignatureEventType): Promise<boolean>;
}
