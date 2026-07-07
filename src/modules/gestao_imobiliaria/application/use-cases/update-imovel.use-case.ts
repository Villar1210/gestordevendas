// src/modules/gestao_imobiliaria/application/use-cases/update-imovel.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  IImovelRepository,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';

interface UpdateImovelInput extends ImovelWritableFields {
  imovelId: string;
  tenantId: string;
}

@Injectable()
export class UpdateImovelUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: UpdateImovelInput): Promise<ImovelRecord> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    if (input.empreendimentoId) {
      const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
        input.empreendimentoId,
        input.tenantId,
      );
      if (!empreendimento) {
        throw new NotFoundException('Empreendimento nao encontrado.');
      }
    }

    const { imovelId, tenantId, ...writableFields } = input;
    return this.imovelRepository.update(imovel.id, writableFields);
  }
}
