// src/modules/edoc/application/use-cases/create-envelope.use-case.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository, SignatureFieldRecord } from '../../domain/repositories/signature-field-repository.interface';
import { ISignatureEventRepository } from '../../domain/repositories/signature-event-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

interface CreateEnvelopeFieldInput {
  // Indice do destinatario dentro do array "recipients" abaixo - o
  // recipientId real so existe depois de criar os destinatarios (ver
  // execute()), entao o frontend referencia por posicao.
  recipientIndex: number;
  // assinatura (padrao) ou rubrica (Fatia 3).
  tipo?: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  heightPercent?: number;
}

interface CreateEnvelopeRecipientInput {
  name: string;
  email: string;
  // destinatario (padrao), remetente ou testemunha (Fatia 3).
  role?: string;
}

interface CreateEnvelopeInput {
  tenantId: string;
  createdByUserId: string;
  title: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
  recipients: CreateEnvelopeRecipientInput[];
  fields: CreateEnvelopeFieldInput[];
}

const DEFAULT_ROLE = 'destinatario';
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
  ) {}

  async execute(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
    if (input.file.mimetype !== 'application/pdf') {
      throw new BadRequestException('O documento precisa ser um arquivo PDF.');
    }
    if (!input.recipients || input.recipients.length === 0) {
      throw new BadRequestException('Informe pelo menos um destinatario.');
    }

    // Cada destinatario precisa de pelo menos 1 campo posicionado - sem
    // isso o GenerateSignedPdfUseCase nao saberia onde carimbar a assinatura.
    const fieldsByRecipientIndex = new Map<number, CreateEnvelopeFieldInput[]>();
    for (const field of input.fields ?? []) {
      if (field.recipientIndex < 0 || field.recipientIndex >= input.recipients.length) {
        throw new BadRequestException('Campo de assinatura aponta para um destinatario invalido.');
      }
      const list = fieldsByRecipientIndex.get(field.recipientIndex) ?? [];
      list.push(field);
      fieldsByRecipientIndex.set(field.recipientIndex, list);
    }
    for (let i = 0; i < input.recipients.length; i++) {
      if (!fieldsByRecipientIndex.get(i)?.length) {
        throw new BadRequestException(
          `Posicione o campo de assinatura de "${input.recipients[i].name}" no documento.`,
        );
      }
    }

    // Testemunha so assina na ultima pagina - nao rubrica o documento (ver
    // CLAUDE.md, regra do campo). Reforcado aqui, na camada de aplicacao,
    // mesmo que o frontend ja nao ofereca essa opcao na UI para esse papel.
    for (const field of input.fields ?? []) {
      const role = input.recipients[field.recipientIndex].role ?? DEFAULT_ROLE;
      const tipo = field.tipo ?? DEFAULT_FIELD_TIPO;
      if (role === 'testemunha' && tipo === 'rubrica') {
        throw new BadRequestException(
          `"${input.recipients[field.recipientIndex].name}" e testemunha e nao pode ter campo de rubrica.`,
        );
      }
    }

    const documentHash = createHash('sha256').update(input.file.buffer).digest('hex');
    const { url } = await this.fileStorageService.upload(input.file);

    const envelope = await this.envelopeRepository.create({
      tenantId: input.tenantId,
      title: input.title,
      documentUrl: url,
      documentHash,
      createdByUserId: input.createdByUserId,
    });

    // Ordem sequencial DENTRO DO PROPRIO GRUPO de role (Fatia 3) - nao mais
    // uma ordem global entre todos os participantes do envelope (ver
    // domain/services/recipient-sequence.ts, que combina isso com o grupo
    // na hora de decidir quem assina primeiro).
    const orderWithinRole = new Map<string, number>();
    const recipients = await this.recipientRepository.createMany(
      envelope.id,
      input.recipients.map((recipient) => {
        const role = recipient.role ?? DEFAULT_ROLE;
        const nextOrder = (orderWithinRole.get(role) ?? 0) + 1;
        orderWithinRole.set(role, nextOrder);
        return {
          name: recipient.name,
          email: recipient.email,
          role,
          order: nextOrder,
        };
      }),
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
