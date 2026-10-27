// src/modules/edoc/application/use-cases/get-signed-pdf.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { podeVerEnvelope } from '../../domain/services/acesso-envelope';
import { ISignatureEnvelopeRepository } from '../../domain/repositories/signature-envelope-repository.interface';

interface GetSignedPdfInput {
  envelopeId: string;
  tenantId: string;
  // Quem pediu (rota HTTP). Ausente = chamada interna (ex.: RH gerando o
  // contrato do corretor) - sem filtro. Ver domain/services/acesso-envelope.ts.
  requesterRole?: string;
  requesterUserId?: string;
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
    // Nao-Administrador so enxerga os envelopes que criou (fase A, 27/10/2026).
    // Responde 404 (nao 403) para nao revelar que o envelope existe.
    if (
      input.requesterRole &&
      input.requesterUserId &&
      !podeVerEnvelope(input.requesterRole, input.requesterUserId, envelope.createdByUserId)
    ) {
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
