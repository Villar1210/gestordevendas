// src/modules/gestao_imobiliaria/application/use-cases/encerrar-contrato.use-case.ts
// Encerra o contrato e devolve o Imovel ao status de disponibilidade:
// "disponivel" (venda cancelada/concluida) ou "vago" (locacao encerrada).
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';
import {
  ContratoRecord,
  IContratoRepository,
} from '../../domain/repositories/contrato-repository.interface';

interface EncerrarContratoInput {
  contratoId: string;
  tenantId: string;
}

@Injectable()
export class EncerrarContratoUseCase {
  constructor(
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: EncerrarContratoInput): Promise<ContratoRecord> {
    const contrato = await this.contratoRepository.findByIdAndTenant(
      input.contratoId,
      input.tenantId,
    );
    if (!contrato) {
      throw new NotFoundException('Contrato nao encontrado.');
    }
    if (contrato.status !== 'ativo') {
      throw new BadRequestException('Este contrato ja esta encerrado ou cancelado.');
    }

    const encerrado = await this.contratoRepository.updateStatus(contrato.id, 'encerrado');

    await this.imovelRepository.update(contrato.imovelId, {
      status: contrato.tipo === 'venda' ? 'disponivel' : 'vago',
    });

    return encerrado;
  }
}
