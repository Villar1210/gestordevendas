// src/modules/edoc/application/use-cases/update-envelope-draft.use-case.ts
// Fatia 4: fecha o "bug do rascunho" junto com GetEnvelopeForEditUseCase -
// permite editar titulo, documento (trocar o arquivo), participantes e
// campos de um envelope que ainda esta em "rascunho". So funciona nesse
// status (mesma restricao do GetEnvelopeForEditUseCase).
import { Injectable, Inject, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository, SignatureFieldRecord } from '../../domain/repositories/signature-field-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';
import { PrepareEnvelopeDocumentService } from '../services/prepare-envelope-document.service';
import {
  RecipientInputLike,
  FieldInputLike,
  validateRecipientsAndFields,
  buildRecipientsWithGroupOrder,
} from '../../domain/services/envelope-validation';

interface UpdateEnvelopeDraftFieldInput extends FieldInputLike {
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  heightPercent?: number;
}

interface UpdateEnvelopeDraftRecipientInput extends RecipientInputLike {}

interface UpdateEnvelopeDraftInput {
  envelopeId: string;
  tenantId: string;
  title: string;
  // Opcional - so enviado quando o usuario troca o arquivo do documento.
  file?: { buffer: Buffer; originalname: string; mimetype: string };
  recipients: UpdateEnvelopeDraftRecipientInput[];
  fields: UpdateEnvelopeDraftFieldInput[];
  emailSubject?: string | null;
  emailMessage?: string | null;
}

export interface UpdateEnvelopeDraftResult {
  envelope: SignatureEnvelopeRecord;
  recipients: SignatureRecipientRecord[];
  fields: SignatureFieldRecord[];
}

const DEFAULT_FIELD_TIPO = 'assinatura';

@Injectable()
export class UpdateEnvelopeDraftUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureFieldRepository')
    private readonly fieldRepository: ISignatureFieldRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
    private readonly prepareEnvelopeDocumentService: PrepareEnvelopeDocumentService,
  ) {}

  async execute(input: UpdateEnvelopeDraftInput): Promise<UpdateEnvelopeDraftResult> {
    const envelope = await this.envelopeRepository.findByIdAndTenant(
      input.envelopeId,
      input.tenantId,
    );
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }
    if (envelope.status !== 'rascunho') {
      throw new ConflictException('Envelope ja foi enviado, nao pode ser editado.');
    }

    const validationError = validateRecipientsAndFields(input.recipients, input.fields);
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const updateData: Partial<{
      title: string;
      documentUrl: string;
      documentHash: string;
      emailSubject: string | null;
      emailMessage: string | null;
    }> = {
      title: input.title,
      emailSubject: input.emailSubject ?? null,
      emailMessage: input.emailMessage ?? null,
    };

    if (input.file) {
      // Documento antigo NAO e removido do disco ao trocar - mesmo
      // comportamento ja aceito em outros pontos do projeto (ex:
      // DeleteInquilinoDocumentoUseCase so remove o registro do banco,
      // nao o arquivo fisico - ver CLAUDE.md).
      const prepared = await this.prepareEnvelopeDocumentService.execute(input.file);
      const { url } = await this.fileStorageService.upload({
        buffer: prepared.buffer,
        originalname: prepared.originalname,
        mimetype: 'application/pdf',
      });
      updateData.documentUrl = url;
      updateData.documentHash = prepared.documentHash;
    }

    const updatedEnvelope = await this.envelopeRepository.update(envelope.id, updateData);

    // Recria participantes e campos do zero - mais simples e seguro do
    // que tentar "diffar" contra o estado anterior (mesma decisao ja
    // tomada no wizard do frontend ao reentrar no Passo 2, ver
    // CreateEnvelopeModal.tsx). onDelete:Cascade no schema remove os
    // SignatureField junto quando os SignatureRecipient sao apagados.
    await this.recipientRepository.deleteAllByEnvelope(envelope.id);
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

    return { envelope: updatedEnvelope, recipients, fields };
  }
}
