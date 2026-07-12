// src/modules/edoc/application/use-cases/get-envelope-for-edit.use-case.ts
// Fatia 4: corrige o "bug do rascunho" - antes desta fatia, um envelope
// que ficasse em "rascunho" (ex: falha no envio logo apos criar) nao
// tinha nenhuma forma de ser reaberto/editado - ficava morto para
// sempre. Este use case devolve o envelope completo (documento,
// participantes, campos) para o wizard do frontend repopular o estado.
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeRecord } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository, SignatureRecipientRecord } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository, SignatureFieldRecord } from '../../domain/repositories/signature-field-repository.interface';

interface GetEnvelopeForEditInput {
  envelopeId: string;
  tenantId: string;
}

export interface GetEnvelopeForEditResult {
  envelope: SignatureEnvelopeRecord;
  recipients: SignatureRecipientRecord[];
  fields: SignatureFieldRecord[];
}

@Injectable()
export class GetEnvelopeForEditUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureFieldRepository')
    private readonly fieldRepository: ISignatureFieldRepository,
  ) {}

  async execute(input: GetEnvelopeForEditInput): Promise<GetEnvelopeForEditResult> {
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

    const [recipients, fields] = await Promise.all([
      this.recipientRepository.findAllByEnvelope(envelope.id),
      this.fieldRepository.findAllByEnvelope(envelope.id),
    ]);

    return { envelope, recipients, fields };
  }
}
