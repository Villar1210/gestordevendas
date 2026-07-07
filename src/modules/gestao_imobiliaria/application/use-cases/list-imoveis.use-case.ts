// src/modules/gestao_imobiliaria/application/use-cases/list-imoveis.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelFilters,
  ImovelRecord,
} from '../../domain/repositories/imovel-repository.interface';

@Injectable()
export class ListImoveisUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: { tenantId: string } & ImovelFilters): Promise<ImovelRecord[]> {
    const { tenantId, ...filters } = input;
    return this.imovelRepository.findAllByTenant(tenantId, filters);
  }
}
