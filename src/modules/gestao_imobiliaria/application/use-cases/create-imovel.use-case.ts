// src/modules/gestao_imobiliaria/application/use-cases/create-imovel.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  IImovelRepository,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';

interface CreateImovelInput extends ImovelWritableFields {
  tenantId: string;
  title: string;
  tipo: string;
  finalidade: string;
}

@Injectable()
export class CreateImovelUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: CreateImovelInput): Promise<ImovelRecord> {
    if (input.empreendimentoId) {
      const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
        input.empreendimentoId,
        input.tenantId,
      );
      if (!empreendimento) {
        throw new NotFoundException('Empreendimento nao encontrado.');
      }
    }

    return this.imovelRepository.create(input);
  }
}
