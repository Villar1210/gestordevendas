// src/modules/gestao_imobiliaria/application/use-cases/list-inquilino-documentos.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInquilinoCompradorRepository,
  InquilinoDocumentoRecord,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

interface ListInquilinoDocumentosInput {
  inquilinoId: string;
  tenantId: string;
}

@Injectable()
export class ListInquilinoDocumentosUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
  ) {}

  async execute(input: ListInquilinoDocumentosInput): Promise<InquilinoDocumentoRecord[]> {
    const inquilino = await this.inquilinoCompradorRepository.findByIdAndTenant(
      input.inquilinoId,
      input.tenantId,
    );
    if (!inquilino) {
      throw new NotFoundException('Inquilino/comprador nao encontrado.');
    }

    return this.inquilinoCompradorRepository.findDocumentosByInquilino(inquilino.id);
  }
}
