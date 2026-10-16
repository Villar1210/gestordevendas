// src/modules/gestao_imobiliaria/application/use-cases/delete-imovel-photo.use-case.ts
// A foto precisa ser do imovel da URL (DELETE /imoveis/:id/photos/:photoId):
// antes so o photoId era conferido. R2: fora o Administrador, so o dono do
// cadastro e antes de publicar.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';
import { AtorImovel } from '../../domain/services/permissao-imovel';
import {
  comBloqueioDeCorrida,
  condicaoDonoPara,
  garantirPodeEditarCadastro,
} from './permissao-imovel.helper';

@Injectable()
export class DeleteImovelPhotoUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: {
    imovelId: string;
    photoId: string;
    tenantId: string;
    ator: AtorImovel;
  }): Promise<void> {
    const photo = await this.imovelRepository.findPhotoByIdAndTenant(
      input.photoId,
      input.tenantId,
    );
    if (!photo || photo.imovelId !== input.imovelId) {
      throw new NotFoundException('Foto nao encontrada.');
    }

    const imovel = await this.imovelRepository.findByIdAndTenant(photo.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }
    garantirPodeEditarCadastro(input.ator, imovel);

    const condicao = condicaoDonoPara(input.ator, input.tenantId);
    await comBloqueioDeCorrida(
      this.imovelRepository.deletePhoto(photo.id, condicao ? { ...condicao, imovelId: imovel.id } : undefined),
      input.ator,
      () => this.imovelRepository.findByIdAndTenant(imovel.id, input.tenantId),
    );
  }
}
