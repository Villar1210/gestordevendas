// src/modules/edoc/application/use-cases/get-signed-pdf.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { ISignatureEnvelopeRepository } from '../../domain/repositories/signature-envelope-repository.interface';

interface GetSignedPdfInput {
  envelopeId: string;
  tenantId: string;
}

@Injectable()
export class GetSignedPdfUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: GetSignedPdfInput): Promise<{ signedDocumentUrl: string }> {
    const envelope = await this.envelopeRepository.findByIdAndTenant(
      input.envelopeId,
      input.tenantId,
    );
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }
    if (envelope.status !== 'concluido') {
      throw new ConflictException('Este envelope ainda nao foi concluido.');
    }
    if (!envelope.signedDocumentUrl) {
      throw new ConflictException(
        'O PDF assinado ainda nao foi gerado. Tente novamente em instantes.',
      );
    }

    return { signedDocumentUrl: envelope.signedDocumentUrl };
  }
}
