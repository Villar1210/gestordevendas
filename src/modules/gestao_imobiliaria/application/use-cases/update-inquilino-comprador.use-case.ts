// src/modules/gestao_imobiliaria/application/use-cases/update-inquilino-comprador.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInquilinoCompradorRepository,
  InquilinoCompradorRecord,
  InquilinoCompradorWritableFields,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

interface UpdateInquilinoCompradorInput extends InquilinoCompradorWritableFields {
  inquilinoId: string;
  tenantId: string;
}

@Injectable()
export class UpdateInquilinoCompradorUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
  ) {}

  async execute(input: UpdateInquilinoCompradorInput): Promise<InquilinoCompradorRecord> {
    const { inquilinoId, tenantId, ...fields } = input;

    const inquilino = await this.inquilinoCompradorRepository.findByIdAndTenant(
      inquilinoId,
      tenantId,
    );
    if (!inquilino) {
      throw new NotFoundException('Inquilino/comprador nao encontrado.');
    }

    return this.inquilinoCompradorRepository.update(inquilinoId, fields);
  }
}
