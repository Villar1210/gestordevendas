// src/modules/gestao_imobiliaria/application/use-cases/reorder-empreendimento-photos.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  EmpreendimentoPhotoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { computePhotoOrders } from '../../domain/services/reorder-photos';

@Injectable()
export class ReorderEmpreendimentoPhotosUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    empreendimentoId: string;
    categoria: string;
    photoIds: string[];
  }): Promise<EmpreendimentoPhotoRecord[]> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    // Reordenacao e sempre DENTRO DE UMA CATEGORIA (ver comentario em
    // EmpreendimentoPhoto no schema.prisma) - so busca/valida contra as
    // fotos dessa categoria, nao todas as fotos do empreendimento.
    const existingPhotos = await this.empreendimentoRepository.findPhotosByEmpreendimentoAndCategoria(
      empreendimento.id,
      input.categoria,
    );

    const existingIds = new Set(existingPhotos.map((photo) => photo.id));
    const providedIds = new Set(input.photoIds);
    const mesmoConjunto =
      existingIds.size === providedIds.size &&
      [...existingIds].every((id) => providedIds.has(id));
    if (!mesmoConjunto) {
      throw new BadRequestException(
        'A lista de fotos informada nao corresponde as fotos existentes desta categoria.',
      );
    }

    const orders = computePhotoOrders(input.photoIds);
    return this.empreendimentoRepository.reorderPhotos(empreendimento.id, input.categoria, orders);
  }
}
