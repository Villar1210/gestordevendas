// src/modules/edoc/application/use-cases/send-envelope.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { sortBySignatureSequence } from '../../domain/services/recipient-sequence';
import { DEFAULT_EMAIL_SUBJECT } from '../../domain/services/envelope-validation';

const DEFAULT_EXPIRE_DAYS = 7;

interface SendEnvelopeInput {
  envelopeId: string;
  tenantId: string;
}

@Injectable()
export class SendEnvelopeUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureEventRepository')
    private readonly eventRepository: ISignatureEventRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  async execute(input: SendEnvelopeInput): Promise<SignatureEnvelopeRecord> {
    const envelope = await this.envelopeRepository.findByIdAndTenant(
      input.envelopeId,
      input.tenantId,
    );
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }
    if (envelope.status !== 'rascunho') {
      throw new ConflictException('Este envelope ja foi enviado.');
    }

    const recipients = await this.recipientRepository.findAllByEnvelope(envelope.id);
    if (recipients.length === 0) {
      throw new ConflictException('O envelope nao tem destinatarios.');
    }

    const expireDays = Number(process.env.SIGNATURE_TOKEN_EXPIRE_DAYS) || DEFAULT_EXPIRE_DAYS;
    const tokenExpiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

    // Cada participante ganha um token, mas so o primeiro da SEQUENCIA
    // (grupo + ordem dentro do grupo - Fatia 3, ver recipient-sequence.ts)
    // recebe o e-mail agora - os demais so recebem quando chegar a vez
    // deles (ver SignDocumentUseCase). Ex: com 2 Destinatarios, 1 Remetente
    // e 1 Testemunha, o e-mail agora vai so para o Destinatario de order=1.
    const sequence = sortBySignatureSequence(recipients);
    for (let i = 0; i < sequence.length; i++) {
      const recipient = sequence[i];
      const accessToken = crypto.randomBytes(32).toString('hex');
      await this.recipientRepository.setTokenAndExpiry(recipient.id, accessToken, tokenExpiresAt);
      if (i === 0) {
        await this.sendSignatureEmail(envelope, recipient.name, recipient.email, accessToken);
      }
    }

    const updated = await this.envelopeRepository.updateStatus(envelope.id, 'aguardando_assinaturas');
    await this.eventRepository.create({ envelopeId: envelope.id, type: 'enviado' });

    return updated;
  }

  private async sendSignatureEmail(
    envelope: Pick<SignatureEnvelopeRecord, 'title' | 'emailSubject' | 'emailMessage'>,
    recipientName: string,
    recipientEmail: string,
    accessToken: string,
  ): Promise<void> {
    const signLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assinar/${accessToken}`;
    // Fatia 4: assunto/mensagem customizaveis pelo criador do envelope -
    // se vazios, cai no template padrao (mesmo texto de sempre).
    const subject = envelope.emailSubject?.trim() || DEFAULT_EMAIL_SUBJECT;
    const customMessage = envelope.emailMessage?.trim()
      ? `<p>${envelope.emailMessage.trim().replace(/\n/g, '<br/>')}</p>`
      : '';

    await this.emailSender.send({
      to: recipientEmail,
      subject,
      body: `<p>Ola, ${recipientName}.</p><p>Voce tem um documento aguardando sua assinatura: <strong>${envelope.title}</strong>.</p>${customMessage}<p><a href="${signLink}">${signLink}</a></p>`,
    });
  }
}
