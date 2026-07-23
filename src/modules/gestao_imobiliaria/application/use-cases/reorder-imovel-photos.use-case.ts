// src/modules/gestao_imobiliaria/application/use-cases/reorder-imovel-photos.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelPhotoRecord,
} from '../../domain/repositories/imovel-repository.interface';
import { computePhotoOrders } from '../../domain/services/reorder-photos';

@Injectable()
export class ReorderImovelPhotosUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: {
    tenantId: string;
    imovelId: string;
    photoIds: string[];
  }): Promise<ImovelPhotoRecord[]> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    const existingPhotos = await this.imovelRepository.findPhotosByImovel(imovel.id);

    // A lista informada precisa corresponder EXATAMENTE (mesmo conjunto de
    // ids) as fotos ja existentes deste imovel - protege contra reordenar
    // com um id de outro imovel/tenant, ou uma lista incompleta que deixaria
    // alguma foto sem "order" definido.
    const existingIds = new Set(existingPhotos.map((photo) => photo.id));
    const providedIds = new Set(input.photoIds);
    const mesmoConjunto =
      existingIds.size === providedIds.size &&
      [...existingIds].every((id) => providedIds.has(id));
    if (!mesmoConjunto) {
      throw new BadRequestException(
        'A lista de fotos informada nao corresponde as fotos existentes deste imovel.',
      );
    }

    const orders = computePhotoOrders(input.photoIds);
    return this.imovelRepository.reorderPhotos(imovel.id, orders);
  }
}
