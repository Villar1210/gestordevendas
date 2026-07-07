// src/modules/gestao_imobiliaria/application/use-cases/get-imovel.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelPhotoRecord,
  ImovelRecord,
} from '../../domain/repositories/imovel-repository.interface';

@Injectable()
export class GetImovelUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: {
    imovelId: string;
    tenantId: string;
  }): Promise<ImovelRecord & { photos: ImovelPhotoRecord[] }> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    const photos = await this.imovelRepository.findPhotosByImovel(imovel.id);
    return { ...imovel, photos };
  }
}
