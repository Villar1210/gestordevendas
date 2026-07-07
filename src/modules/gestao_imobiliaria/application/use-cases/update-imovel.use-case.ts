// src/modules/gestao_imobiliaria/application/use-cases/update-imovel.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository, ImovelRecord } from '../../domain/repositories/imovel-repository.interface';

interface UpdateImovelInput {
  imovelId: string;
  tenantId: string;
  empreendimentoId?: string | null;
  title?: string;
  tipo?: string;
  finalidade?: string;
  price?: number | null;
  rentPrice?: number | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpots?: number | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  description?: string | null;
  status?: string;
  customFields?: Record<string, unknown>;
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

    return this.imovelRepository.update(imovel.id, {
      empreendimentoId: input.empreendimentoId,
      title: input.title,
      tipo: input.tipo,
      finalidade: input.finalidade,
      price: input.price,
      rentPrice: input.rentPrice,
      area: input.area,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      parkingSpots: input.parkingSpots,
      rua: input.rua,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cidade: input.cidade,
      uf: input.uf,
      cep: input.cep,
      description: input.description,
      status: input.status,
      customFields: input.customFields,
    });
  }
}
