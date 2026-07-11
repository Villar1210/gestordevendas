// src/modules/edoc/domain/repositories/signature-field-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface SignatureFieldRecord {
  id: string;
  envelopeId: string;
  recipientId: string;
  // assinatura ou rubrica (Fatia 3) - ver nota no schema.prisma.
  tipo: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface ISignatureFieldRepository {
  createMany(
    envelopeId: string,
    fields: {
      recipientId: string;
      tipo: string;
      pageNumber: number;
      xPercent: number;
      yPercent: number;
      widthPercent?: number;
      heightPercent?: number;
    }[],
  ): Promise<SignatureFieldRecord[]>;
  findAllByEnvelope(envelopeId: string): Promise<SignatureFieldRecord[]>;
  findAllByRecipient(recipientId: string): Promise<SignatureFieldRecord[]>;
}
