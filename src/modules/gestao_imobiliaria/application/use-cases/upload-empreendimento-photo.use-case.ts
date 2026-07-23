// src/modules/gestao_imobiliaria/application/use-cases/upload-empreendimento-photo.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoPhotoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

interface UploadEmpreendimentoPhotoInput {
  empreendimentoId: string;
  tenantId: string;
  categoria: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
}

@Injectable()
export class UploadEmpreendimentoPhotoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
  ) {}

  async execute(input: UploadEmpreendimentoPhotoInput): Promise<EmpreendimentoPhotoRecord> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const { url } = await this.fileStorageService.upload(input.file);

    // order e sequencial DENTRO DA CATEGORIA (nao global no empreendimento) -
    // ver comentario em EmpreendimentoPhoto no schema.prisma.
    const existingPhotosNaCategoria =
      await this.empreendimentoRepository.findPhotosByEmpreendimentoAndCategoria(
        empreendimento.id,
        input.categoria,
      );

    return this.empreendimentoRepository.addPhoto({
      tenantId: input.tenantId,
      empreendimentoId: empreendimento.id,
      categoria: input.categoria,
      url,
      order: existingPhotosNaCategoria.length,
    });
  }
}
