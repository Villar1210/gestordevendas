// src/modules/edoc/application/use-cases/create-envelope.use-case.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository, SignatureFieldRecord } from '../../domain/repositories/signature-field-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';
import { PrepareEnvelopeDocumentService } from '../services/prepare-envelope-document.service';
import {
  RecipientInputLike,
  FieldInputLike,
  validateRecipientsAndFields,
  buildRecipientsWithGroupOrder,
} from '../../domain/services/envelope-validation';

interface CreateEnvelopeFieldInput extends FieldInputLike {
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  heightPercent?: number;
}

interface CreateEnvelopeRecipientInput extends RecipientInputLike {}

interface CreateEnvelopeInput {
  tenantId: string;
  createdByUserId: string;
  title: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
  recipients: CreateEnvelopeRecipientInput[];
  fields: CreateEnvelopeFieldInput[];
  emailSubject?: string | null;
  emailMessage?: string | null;
}

const DEFAULT_FIELD_TIPO = 'assinatura';

export interface CreateEnvelopeResult {
  envelope: SignatureEnvelopeRecord;
  recipients: SignatureRecipientRecord[];
  fields: SignatureFieldRecord[];
}

@Injectable()
export class CreateEnvelopeUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureFieldRepository')
    private readonly fieldRepository: ISignatureFieldRepository,
    @Inject('ISignatureEventRepository')
    private readonly eventRepository: ISignatureEventRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
    private readonly prepareEnvelopeDocumentService: PrepareEnvelopeDocumentService,
  ) {}

  async execute(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
    const validationError = validateRecipientsAndFields(input.recipients, input.fields);
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    // Word/Excel (.doc/.docx/.xls/.xlsx) sao convertidos para PDF aqui
    // (Fatia 4) - se ja for PDF, o buffer volta inalterado. Documento
    // sempre vira PDF antes de calcular hash/salvar.
    const prepared = await this.prepareEnvelopeDocumentService.execute(input.file);
    const { url } = await this.fileStorageService.upload({
      buffer: prepared.buffer,
      originalname: prepared.originalname,
      mimetype: 'application/pdf',
    });

    const envelope = await this.envelopeRepository.create({
      tenantId: input.tenantId,
      title: input.title,
      documentUrl: url,
      documentHash: prepared.documentHash,
      createdByUserId: input.createdByUserId,
      emailSubject: input.emailSubject ?? null,
      emailMessage: input.emailMessage ?? null,
    });

    const recipients = await this.recipientRepository.createMany(
      envelope.id,
      buildRecipientsWithGroupOrder(input.recipients),
    );

    const fields = await this.fieldRepository.createMany(
      envelope.id,
      input.fields.map((field) => ({
        recipientId: recipients[field.recipientIndex].id,
        tipo: field.tipo ?? DEFAULT_FIELD_TIPO,
        pageNumber: field.pageNumber,
        xPercent: field.xPercent,
        yPercent: field.yPercent,
        widthPercent: field.widthPercent,
        heightPercent: field.heightPercent,
      })),
    );

    await this.eventRepository.create({ envelopeId: envelope.id, type: 'criado' });

    return { envelope, recipients, fields };
  }
}
