// src/modules/gestao_imobiliaria/application/use-cases/atualizar-status-vencidos.use-case.ts
// Sem scheduler automatico (fora do escopo desta fatia) - chamado toda vez
// que ListLancamentosUseCase roda, e tambem disponivel via botao manual
// (POST /financeiro/gerar-cobrancas-mes nao chama este - so a listagem).
import { Injectable, Inject } from '@nestjs/common';
import { ILancamentoFinanceiroRepository } from '../../domain/repositories/lancamento-financeiro-repository.interface';

interface AtualizarStatusVencidosInput {
  tenantId: string;
}

@Injectable()
export class AtualizarStatusVencidosUseCase {
  constructor(
    @Inject('ILancamentoFinanceiroRepository')
    private readonly lancamentoRepository: ILancamentoFinanceiroRepository,
  ) {}

  async execute(input: AtualizarStatusVencidosInput): Promise<{ atualizados: number }> {
    const atualizados = await this.lancamentoRepository.updateManyStatusToAtrasado(
      input.tenantId,
      new Date(),
    );
    return { atualizados };
  }
}
