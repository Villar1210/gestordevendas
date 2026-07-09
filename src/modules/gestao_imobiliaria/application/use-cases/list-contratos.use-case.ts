// src/modules/gestao_imobiliaria/application/use-cases/list-contratos.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  ContratoRecord,
  IContratoRepository,
} from '../../domain/repositories/contrato-repository.interface';

interface ListContratosInput {
  tenantId: string;
  tipo?: string;
  status?: string;
  imovelId?: string;
  proprietarioId?: string;
}

@Injectable()
export class ListContratosUseCase {
  constructor(
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
  ) {}

  async execute(input: ListContratosInput): Promise<ContratoRecord[]> {
    const { tenantId, ...filters } = input;
    return this.contratoRepository.findAllByTenant(tenantId, filters);
  }
}
