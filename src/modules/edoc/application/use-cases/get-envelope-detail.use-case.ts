// src/modules/edoc/application/use-cases/get-envelope-detail.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';

interface GetEnvelopeDetailInput {
  envelopeId: string;
  tenantId: string;
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

    const recipients = await this.recipientRepository.findAllByEnvelope(envelope.id);

    return { envelope, recipients };
  }
}
