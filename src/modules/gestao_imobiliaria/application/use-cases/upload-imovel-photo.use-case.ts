// src/modules/gestao_imobiliaria/application/use-cases/upload-imovel-photo.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelPhotoRecord,
} from '../../domain/repositories/imovel-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';
import { AtorImovel } from '../../domain/services/permissao-imovel';
import { fotoValidadaParaUpload } from './foto-upload.helper';
import {
  comBloqueioDeCorrida,
  condicaoDonoPara,
  garantirPodeEditarCadastro,
} from './permissao-imovel.helper';

interface UploadImovelPhotoInput {
  imovelId: string;
  tenantId: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
  ator: AtorImovel;
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
    // R2: fora o Administrador, so o dono do cadastro e antes de publicar.
    // Checado ANTES do upload para nao gravar arquivo orfao no disco.
    garantirPodeEditarCadastro(input.ator, imovel);
    // Tipo real pelos bytes (JPG/PNG/WebP) e nome no disco derivado dele.
    const foto = fotoValidadaParaUpload(input.file);

    const { url } = await this.fileStorageService.upload(foto);

    const existingPhotos = await this.imovelRepository.findPhotosByImovel(imovel.id);

    return comBloqueioDeCorrida(
      this.imovelRepository.addPhoto(
        {
          tenantId: input.tenantId,
          imovelId: imovel.id,
          url,
          order: existingPhotos.length,
        },
        condicaoDonoPara(input.ator, input.tenantId),
      ),
      input.ator,
      () => this.imovelRepository.findByIdAndTenant(imovel.id, input.tenantId),
    );
  }
}
