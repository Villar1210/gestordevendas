// src/modules/gestao_imobiliaria/application/use-cases/delete-imovel-photo.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';

@Injectable()
export class DeleteImovelPhotoUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: { photoId: string; tenantId: string }): Promise<void> {
    const photo = await this.imovelRepository.findPhotoByIdAndTenant(
      input.photoId,
      input.tenantId,
    );
    if (!photo) {
      throw new NotFoundException('Foto nao encontrada.');
    }

    await this.imovelRepository.deletePhoto(photo.id);
  }
}
