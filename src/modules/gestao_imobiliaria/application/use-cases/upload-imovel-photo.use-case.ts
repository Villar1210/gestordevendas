// src/modules/gestao_imobiliaria/application/use-cases/upload-imovel-photo.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelPhotoRecord,
} from '../../domain/repositories/imovel-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

interface UploadImovelPhotoInput {
  imovelId: string;
  tenantId: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
}

@Injectable()
export class UploadImovelPhotoUseCase {
  constructor(
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
  ) {}

  async execute(input: UploadImovelPhotoInput): Promise<ImovelPhotoRecord> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    const { url } = await this.fileStorageService.upload(input.file);

    const existingPhotos = await this.imovelRepository.findPhotosByImovel(imovel.id);

    return this.imovelRepository.addPhoto({
      tenantId: input.tenantId,
      imovelId: imovel.id,
      url,
      order: existingPhotos.length,
    });
  }
}
