// src/modules/edoc/application/use-cases/get-envelope-by-token.use-case.ts
// Rota PUBLICA (sem JWT) - o token e a propria fronteira de seguranca.
import { Injectable, Inject, NotFoundException, GoneException } from '@nestjs/common';
import { ISignatureEnvelopeRepository } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository, SignatureFieldRecord } from '../../domain/repositories/signature-field-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';

interface GetEnvelopeByTokenInput {
  token: string;
}

export interface GetEnvelopeByTokenResult {
  envelope: { title: string; documentUrl: string; status: string };
  recipient: { name: string; email: string; status: string };
  // Fatia 3: Destinatario/Remetente tem varios campos (1 rubrica por
  // pagina + 1 assinatura na ultima) - a tela publica usa isso para o
  // indicador "Campo X de Y" e a navegacao automatica entre paginas.
  fields: Pick<SignatureFieldRecord, 'pageNumber' | 'xPercent' | 'yPercent' | 'widthPercent' | 'heightPercent' | 'tipo'>[];
}

@Injectable()
export class GetEnvelopeByTokenUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureFieldRepository')
    private readonly fieldRepository: ISignatureFieldRepository,
    @Inject('ISignatureEventRepository')
    private readonly eventRepository: ISignatureEventRepository,
  ) {}

  async execute(input: GetEnvelopeByTokenInput): Promise<GetEnvelopeByTokenResult> {
    const recipient = await this.recipientRepository.findByToken(input.token);
    if (!recipient) {
      throw new NotFoundException('Link de assinatura invalido.');
    }
    if (!recipient.tokenExpiresAt || recipient.tokenExpiresAt < new Date()) {
      throw new GoneException('Este link de assinatura expirou.');
    }

    const envelope = await this.envelopeRepository.findById(recipient.envelopeId);
    if (!envelope) {
      throw new NotFoundException('Documento nao encontrado.');
    }
    if (envelope.status === 'cancelado') {
      throw new GoneException('Este documento foi cancelado.');
    }

    const alreadyViewed = await this.eventRepository.existsByRecipientAndType(
      recipient.id,
      'visualizado',
    );
    if (!alreadyViewed) {
      await this.eventRepository.create({
        envelopeId: envelope.id,
        recipientId: recipient.id,
        type: 'visualizado',
      });
    }

    const fields = await this.fieldRepository.findAllByRecipient(recipient.id);
    // Rubricas em ordem de pagina, assinatura sempre por ultimo - ordem
    // natural de preenchimento na tela publica ("Campo 1 de N" ...).
    const orderedFields = [...fields].sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'rubrica' ? -1 : 1;
      return a.pageNumber - b.pageNumber;
    });

    return {
      envelope: { title: envelope.title, documentUrl: envelope.documentUrl, status: envelope.status },
      recipient: { name: recipient.name, email: recipient.email, status: recipient.status },
      fields: orderedFields.map((field) => ({
        pageNumber: field.pageNumber,
        xPercent: field.xPercent,
        yPercent: field.yPercent,
        widthPercent: field.widthPercent,
        heightPercent: field.heightPercent,
        tipo: field.tipo,
      })),
    };
  }
}
