// src/modules/edoc/application/use-cases/cancel-envelope.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';

interface CancelEnvelopeInput {
  envelopeId: string;
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
}

@Injectable()
export class CancelEnvelopeUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureEventRepository')
    private readonly eventRepository: ISignatureEventRepository,
  ) {}

  async execute(input: CancelEnvelopeInput): Promise<SignatureEnvelopeRecord> {
    const envelope = await this.envelopeRepository.findByIdAndTenant(
      input.envelopeId,
      input.tenantId,
    );
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }

    const isOwner = envelope.createdByUserId === input.requesterUserId;
    if (input.requesterRole !== 'Administrador' && !isOwner) {
      throw new ForbiddenException(
        'Apenas o Administrador ou quem criou o envelope pode cancela-lo.',
      );
    }

    if (envelope.status === 'concluido' || envelope.status === 'cancelado') {
      throw new ConflictException('Este envelope nao pode mais ser cancelado.');
    }

    const updated = await this.envelopeRepository.updateStatus(envelope.id, 'cancelado');
    // Nao ha um campo de "invalidado" no destinatario - a checagem de
    // status do envelope (cancelado) em GetEnvelopeByTokenUseCase e
    // SignDocumentUseCase ja bloqueia qualquer token pendente.
    await this.eventRepository.create({ envelopeId: envelope.id, type: 'cancelado' });

    return updated;
  }
}
