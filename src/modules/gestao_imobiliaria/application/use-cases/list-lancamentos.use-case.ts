// src/modules/gestao_imobiliaria/application/use-cases/list-lancamentos.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  ILancamentoFinanceiroRepository,
  LancamentoFinanceiroRecord,
} from '../../domain/repositories/lancamento-financeiro-repository.interface';
import { AtualizarStatusVencidosUseCase } from './atualizar-status-vencidos.use-case';

interface ListLancamentosInput {
  tenantId: string;
  tipo?: string;
  status?: string;
  contratoId?: string;
  vencimentoDe?: Date;
  vencimentoAte?: Date;
}

@Injectable()
export class ListLancamentosUseCase {
  constructor(
    @Inject('ILancamentoFinanceiroRepository')
    private readonly lancamentoRepository: ILancamentoFinanceiroRepository,
    private readonly atualizarStatusVencidosUseCase: AtualizarStatusVencidosUseCase,
  ) {}

  async execute(input: ListLancamentosInput): Promise<LancamentoFinanceiroRecord[]> {
    // Mantem o status "atrasado" sempre em dia antes de listar - ver nota em
    // AtualizarStatusVencidosUseCase (sem scheduler, so roda sob demanda).
    await this.atualizarStatusVencidosUseCase.execute({ tenantId: input.tenantId });

    return this.lancamentoRepository.findAllByTenant(input.tenantId, {
      tipo: input.tipo,
      status: input.status,
      contratoId: input.contratoId,
      vencimentoDe: input.vencimentoDe,
      vencimentoAte: input.vencimentoAte,
    });
  }
}
