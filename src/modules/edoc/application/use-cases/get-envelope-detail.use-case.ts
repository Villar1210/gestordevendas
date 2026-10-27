// src/modules/edoc/application/use-cases/get-envelope-detail.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { podeVerEnvelope } from '../../domain/services/acesso-envelope';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';

interface GetEnvelopeDetailInput {
  envelopeId: string;
  tenantId: string;
  // Quem pediu (rota HTTP). Ausente = chamada interna (ex.: RH gerando o
  // contrato do corretor) - sem filtro. Ver domain/services/acesso-envelope.ts.
  requesterRole?: string;
  requesterUserId?: string;
}

export interface EnvelopeDetailResult {
  envelope: SignatureEnvelopeRecord;
  recipients: SignatureRecipientRecord[];
}

@Injectable()
export class GetEnvelopeDetailUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
  ) {}

  async execute(input: GetEnvelopeDetailInput): Promise<EnvelopeDetailResult> {
    const envelope = await this.envelopeRepository.findByIdAndTenant(
      input.envelopeId,
      input.tenantId,
    );
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }
    // Nao-Administrador so enxerga os envelopes que criou (fase A, 27/10/2026).
    // Responde 404 (nao 403) para nao revelar que o envelope existe.
    if (
      input.requesterRole &&
      input.requesterUserId &&
      !podeVerEnvelope(input.requesterRole, input.requesterUserId, envelope.createdByUserId)
    ) {
      throw new NotFoundException('Envelope nao encontrado.');
    }

    const recipients = await this.recipientRepository.findAllByEnvelope(envelope.id);

    return { envelope, recipients };
  }
}
