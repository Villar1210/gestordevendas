// src/modules/gestao_imobiliaria/application/use-cases/create-lancamento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IContratoRepository } from '../../domain/repositories/contrato-repository.interface';
import {
  ILancamentoFinanceiroRepository,
  LancamentoFinanceiroRecord,
} from '../../domain/repositories/lancamento-financeiro-repository.interface';

interface CreateLancamentoInput {
  tenantId: string;
  contratoId?: string | null;
  tipo: string;
  categoria: string;
  valor: number;
  vencimento: Date;
  descricao?: string | null;
}

@Injectable()
export class CreateLancamentoUseCase {
  constructor(
    @Inject('ILancamentoFinanceiroRepository')
    private readonly lancamentoRepository: ILancamentoFinanceiroRepository,
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
  ) {}

  async execute(input: CreateLancamentoInput): Promise<LancamentoFinanceiroRecord> {
    if (input.contratoId) {
      const contrato = await this.contratoRepository.findByIdAndTenant(
        input.contratoId,
        input.tenantId,
      );
      if (!contrato) {
        throw new NotFoundException('Contrato nao encontrado.');
      }
    }

    return this.lancamentoRepository.create({
      tenantId: input.tenantId,
      contratoId: input.contratoId ?? null,
      tipo: input.tipo,
      categoria: input.categoria,
      valor: input.valor,
      vencimento: input.vencimento,
      descricao: input.descricao,
    });
  }
}
