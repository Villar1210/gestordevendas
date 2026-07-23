// src/modules/gestao_imobiliaria/application/use-cases/delete-empreendimento-photo.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';

@Injectable()
export class DeleteEmpreendimentoPhotoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
  ) {}

  async execute(input: { photoId: string; tenantId: string }): Promise<void> {
    const photo = await this.empreendimentoRepository.findPhotoByIdAndTenant(
      input.photoId,
      input.tenantId,
    );
    if (!photo) {
      throw new NotFoundException('Foto nao encontrada.');
    }

    await this.empreendimentoRepository.deletePhoto(photo.id);
  }
}
