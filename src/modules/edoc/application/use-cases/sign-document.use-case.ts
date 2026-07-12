// src/modules/edoc/application/use-cases/sign-document.use-case.ts
// Rota PUBLICA (sem JWT) - o token e a propria fronteira de seguranca.
import { Injectable, Inject, Logger, NotFoundException, GoneException, ConflictException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ISignatureEnvelopeRepository } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { GenerateSignedPdfUseCase } from './generate-signed-pdf.use-case';
import { sortBySignatureSequence } from '../../domain/services/recipient-sequence';
import { DEFAULT_EMAIL_SUBJECT } from '../../domain/services/envelope-validation';
import { SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';

// Assinatura em PNG (data URL) tem limite de tamanho - mesmo padrao do
// projeto antigo (ver CLAUDE.md, modulo E-doc). "Digitar nome" nao passa
// por essa checagem - e so o texto puro do nome digitado.
const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;
const PNG_DATA_URL_REGEX = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/;
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface SignDocumentInput {
  token: string;
  signatureImageData: string;
  signerIp: string | null;
  signerUserAgent: string | null;
}

@Injectable()
export class SignDocumentUseCase {
  private readonly logger = new Logger(SignDocumentUseCase.name);

  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureEventRepository')
    private readonly eventRepository: ISignatureEventRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
    private readonly generateSignedPdfUseCase: GenerateSignedPdfUseCase,
  ) {}

  async execute(input: SignDocumentInput): Promise<{ status: string }> {
    const recipient = await this.recipientRepository.findByToken(input.token);
    if (!recipient) {
      throw new NotFoundException('Link de assinatura invalido.');
    }
    if (!recipient.tokenExpiresAt || recipient.tokenExpiresAt < new Date()) {
      throw new GoneException('Este link de assinatura expirou.');
    }
    if (recipient.status === 'assinado') {
      throw new ConflictException('Este documento ja foi assinado por voce.');
    }

    const envelope = await this.envelopeRepository.findById(recipient.envelopeId);
    if (!envelope) {
      throw new NotFoundException('Documento nao encontrado.');
    }
    if (envelope.status === 'cancelado') {
      throw new GoneException('Este documento foi cancelado.');
    }

    // Ordem sequencial estrita: ninguem assina fora da vez, mesmo que ja
    // tenha um token valido (todos os tokens sao gerados juntos no envio).
    // Fatia 3: a sequencia combina GRUPO (role) + ordem dentro do grupo -
    // ver domain/services/recipient-sequence.ts. Busca a lista completa
    // uma vez e reaproveita tanto para o bloqueio abaixo quanto para achar
    // o "proximo" depois de marcar esta assinatura.
    const allRecipients = await this.recipientRepository.findAllByEnvelope(envelope.id);
    const sequence = sortBySignatureSequence(allRecipients);
    const myIndex = sequence.findIndex((r) => r.id === recipient.id);
    const pendingBefore = sequence
      .slice(0, myIndex)
      .filter((r) => r.status !== 'assinado').length;
    if (pendingBefore > 0) {
      throw new ConflictException('Aguardando a assinatura do(s) participante(s) anterior(es).');
    }

    const { normalized, hash } = this.validateAndHashSignature(input.signatureImageData);

    await this.recipientRepository.markSigned(recipient.id, {
      signatureImageData: normalized,
      signatureHash: hash,
      signerIp: input.signerIp,
      signerUserAgent: input.signerUserAgent,
    });

    await this.eventRepository.create({
      envelopeId: envelope.id,
      recipientId: recipient.id,
      type: 'assinado',
      ipAddress: input.signerIp,
      userAgent: input.signerUserAgent,
    });

    const next = sequence[myIndex + 1];
    if (next) {
      await this.sendSignatureEmail(envelope, next);
      await this.eventRepository.create({ envelopeId: envelope.id, type: 'enviado' });
      return { status: 'aguardando_assinaturas' };
    }

    await this.envelopeRepository.completeWithEvent(envelope.id);

    try {
      await this.generateSignedPdfUseCase.execute({ envelopeId: envelope.id });
    } catch (error) {
      // A assinatura ja foi registrada e o envelope ja esta "concluido" -
      // uma falha aqui (ex: PDF corrompido) nao deve desfazer isso, so
      // fica sem signedDocumentUrl (nulo) ate uma geracao manual futura.
      this.logger.error(
        `Falha ao gerar o PDF final do envelope ${envelope.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    return { status: 'concluido' };
  }

  private validateAndHashSignature(raw: string): { normalized: string; hash: string } {
    if (!raw || !raw.trim()) {
      throw new BadRequestException('Assinatura invalida.');
    }

    const dataUrlMatch = raw.match(PNG_DATA_URL_REGEX);
    if (dataUrlMatch) {
      const buffer = Buffer.from(dataUrlMatch[1], 'base64');
      if (buffer.length > MAX_SIGNATURE_IMAGE_BYTES) {
        throw new BadRequestException('Imagem da assinatura muito grande.');
      }
      if (!buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES)) {
        throw new BadRequestException('Imagem da assinatura invalida.');
      }
      return { normalized: raw, hash: createHash('sha256').update(buffer).digest('hex') };
    }

    // Nao e uma data URL - trata como nome digitado (texto puro).
    if (raw.length > 150) {
      throw new BadRequestException('Nome digitado muito longo.');
    }
    return { normalized: raw, hash: createHash('sha256').update(raw, 'utf8').digest('hex') };
  }

  private async sendSignatureEmail(
    envelope: Pick<SignatureEnvelopeRecord, 'title' | 'emailSubject' | 'emailMessage'>,
    recipient: SignatureRecipientRecord,
  ): Promise<void> {
    const signLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assinar/${recipient.accessToken}`;
    // Fatia 4: mesmo assunto/mensagem customizados usados no primeiro
    // envio (SendEnvelopeUseCase) - todo e-mail deste envelope segue a
    // mesma customizacao, nao so o do primeiro destinatario.
    const subject = envelope.emailSubject?.trim() || DEFAULT_EMAIL_SUBJECT;
    const customMessage = envelope.emailMessage?.trim()
      ? `<p>${envelope.emailMessage.trim().replace(/\n/g, '<br/>')}</p>`
      : '';

    await this.emailSender.send({
      to: recipient.email,
      subject,
      body: `<p>Ola, ${recipient.name}.</p><p>Voce tem um documento aguardando sua assinatura: <strong>${envelope.title}</strong>.</p>${customMessage}<p><a href="${signLink}">${signLink}</a></p>`,
    });
  }
}
