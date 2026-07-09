// src/modules/gestao_imobiliaria/application/use-cases/get-contrato.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ContratoRecord,
  IContratoRepository,
} from '../../domain/repositories/contrato-repository.interface';

interface GetContratoInput {
  contratoId: string;
  tenantId: string;
}

@Injectable()
export class GetContratoUseCase {
  constructor(
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
  ) {}

  async execute(input: GetContratoInput): Promise<ContratoRecord> {
    const contrato = await this.contratoRepository.findByIdAndTenant(
      input.contratoId,
      input.tenantId,
    );
    if (!contrato) {
      throw new NotFoundException('Contrato nao encontrado.');
    }
    return contrato;
  }
}
