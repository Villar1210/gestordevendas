// src/modules/gestao_imobiliaria/application/use-cases/marcar-como-pago.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import {
  ILancamentoFinanceiroRepository,
  LancamentoFinanceiroRecord,
} from '../../domain/repositories/lancamento-financeiro-repository.interface';

interface MarcarComoPagoInput {
  lancamentoId: string;
  tenantId: string;
}

@Injectable()
export class MarcarComoPagoUseCase {
  constructor(
    @Inject('ILancamentoFinanceiroRepository')
    private readonly lancamentoRepository: ILancamentoFinanceiroRepository,
  ) {}

  async execute(input: MarcarComoPagoInput): Promise<LancamentoFinanceiroRecord> {
    const lancamento = await this.lancamentoRepository.findByIdAndTenant(
      input.lancamentoId,
      input.tenantId,
    );
    if (!lancamento) {
      throw new NotFoundException('Lancamento nao encontrado.');
    }
    if (lancamento.status === 'pago') {
      throw new ConflictException('Este lancamento ja esta marcado como pago.');
    }

    return this.lancamentoRepository.markAsPago(input.lancamentoId, new Date());
  }
}
