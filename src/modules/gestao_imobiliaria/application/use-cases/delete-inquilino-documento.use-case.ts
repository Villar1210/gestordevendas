// src/modules/gestao_imobiliaria/application/use-cases/delete-inquilino-documento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IInquilinoCompradorRepository } from '../../domain/repositories/inquilino-comprador-repository.interface';

interface DeleteInquilinoDocumentoInput {
  documentoId: string;
  tenantId: string;
}

@Injectable()
export class DeleteInquilinoDocumentoUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
  ) {}

  async execute(input: DeleteInquilinoDocumentoInput): Promise<void> {
    const documento = await this.inquilinoCompradorRepository.findDocumentoByIdAndTenant(
      input.documentoId,
      input.tenantId,
    );
    if (!documento) {
      throw new NotFoundException('Documento nao encontrado.');
    }

    await this.inquilinoCompradorRepository.deleteDocumento(documento.id);
  }
}
