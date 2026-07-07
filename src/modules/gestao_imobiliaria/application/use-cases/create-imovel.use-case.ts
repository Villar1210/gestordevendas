// src/modules/gestao_imobiliaria/application/use-cases/create-imovel.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository, ImovelRecord } from '../../domain/repositories/imovel-repository.interface';

interface CreateImovelInput {
  tenantId: string;
  empreendimentoId?: string;
  title: string;
  tipo: string;
  finalidade: string;
  price?: number;
  rentPrice?: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpots?: number;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  description?: string;
  status?: string;
  customFields?: Record<string, unknown>;
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
