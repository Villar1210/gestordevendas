// src/modules/edoc/domain/repositories/signature-recipient-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface SignatureRecipientRecord {
  id: string;
  envelopeId: string;
  name: string;
  email: string;
  order: number;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
  status: string;
  signedAt: Date | null;
  signatureImageData: string | null;
  signatureHash: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
}

// Usado pelo Portal do Cliente (GetMinhasAssinaturasPendentesUseCase /
// GetMeusDocumentosAssinadosUseCase) - inclui os dados do envelope que o
// frontend precisa, sem expor o repositorio de envelope inteiro so por isso.
export interface SignatureRecipientWithEnvelope extends SignatureRecipientRecord {
  envelopeTitle: string;
  envelopeStatus: string;
  envelopeSignedDocumentUrl: string | null;
}

export interface ISignatureRecipientRepository {
  createMany(
    envelopeId: string,
    recipients: { name: string; email: string; order: number }[],
  ): Promise<SignatureRecipientRecord[]>;
  findAllByEnvelope(envelopeId: string): Promise<SignatureRecipientRecord[]>;
  findByToken(token: string): Promise<SignatureRecipientRecord | null>;
  setTokenAndExpiry(id: string, accessToken: string, tokenExpiresAt: Date): Promise<void>;
  markSigned(
    id: string,
    input: {
      signatureImageData: string;
      signatureHash: string;
      signerIp: string | null;
      signerUserAgent: string | null;
    },
  ): Promise<SignatureRecipientRecord>;
  // Proximo destinatario na ordem sequencial (order = fromOrder + 1), se existir.
  findNextInOrder(envelopeId: string, fromOrder: number): Promise<SignatureRecipientRecord | null>;
  // Quantos destinatarios com order menor que o informado ainda NAO assinaram -
  // usado para bloquear assinatura fora de ordem (ver SignDocumentUseCase).
  countPendingBeforeOrder(envelopeId: string, order: number): Promise<number>;
  // Usado pelo Portal do Cliente para vincular o usuario logado (por
  // e-mail) aos envelopes onde ele e destinatario - ver CLAUDE.md sobre a
  // limitacao dessa correspondencia (por valor, nao por FK formal).
  // Escopado por tenant via join no envelope (SignatureRecipient nao tem
  // tenantId proprio - ver nota no schema.prisma).
  findAllByEmailAndTenant(
    tenantId: string,
    email: string,
  ): Promise<SignatureRecipientWithEnvelope[]>;
}
