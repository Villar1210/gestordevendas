// src/modules/gestao_imobiliaria/application/use-cases/upload-inquilino-documento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInquilinoCompradorRepository,
  InquilinoDocumentoRecord,
} from '../../domain/repositories/inquilino-comprador-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

interface UploadInquilinoDocumentoInput {
  inquilinoId: string;
  tenantId: string;
  tipo: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
}

@Injectable()
export class UploadInquilinoDocumentoUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
  ) {}

  async execute(input: UploadInquilinoDocumentoInput): Promise<InquilinoDocumentoRecord> {
    const inquilino = await this.inquilinoCompradorRepository.findByIdAndTenant(
      input.inquilinoId,
      input.tenantId,
    );
    if (!inquilino) {
      throw new NotFoundException('Inquilino/comprador nao encontrado.');
    }

    const { url } = await this.fileStorageService.upload(input.file);

    return this.inquilinoCompradorRepository.addDocumento({
      tenantId: input.tenantId,
      inquilinoId: inquilino.id,
      tipo: input.tipo,
      url,
      nomeArquivo: input.file.originalname,
    });
  }
}
