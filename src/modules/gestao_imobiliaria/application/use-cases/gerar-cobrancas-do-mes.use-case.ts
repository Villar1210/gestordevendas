// src/modules/gestao_imobiliaria/application/use-cases/gerar-cobrancas-do-mes.use-case.ts
// Busca todos os Contratos de locacao ativos e gera 1 LancamentoFinanceiro
// (tipo=receita, categoria=aluguel) para cada um, se ainda nao existir um
// para o mes-alvo - seguro rodar mais de uma vez (idempotente por mes-alvo).
import { Injectable, Inject } from '@nestjs/common';
import { IContratoRepository } from '../../domain/repositories/contrato-repository.interface';
import { ILancamentoFinanceiroRepository } from '../../domain/repositories/lancamento-financeiro-repository.interface';

interface GerarCobrancasDoMesInput {
  tenantId: string;
}

const TIPO_RECEITA = 'receita';
const CATEGORIA_ALUGUEL = 'aluguel';

// Calcula o vencimento para um diaVencimento (1-31) dentro do mes/ano de
// referenceDate, com clamp para o ultimo dia do mes se ele nao tiver esse
// dia (ex: diaVencimento=31 em fevereiro vira 28/29).
function computeVencimentoNoMes(diaVencimento: number, referenceDate: Date): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(diaVencimento, lastDayOfMonth);
  return new Date(year, month, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

@Injectable()
export class GerarCobrancasDoMesUseCase {
  constructor(
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
    @Inject('ILancamentoFinanceiroRepository')
    private readonly lancamentoRepository: ILancamentoFinanceiroRepository,
  ) {}

  async execute(input: GerarCobrancasDoMesInput): Promise<{ criados: number }> {
    const contratos = await this.contratoRepository.findAllByTenant(input.tenantId, {
      tipo: 'locacao',
      status: 'ativo',
    });

    const hoje = new Date();
    let criados = 0;

    for (const contrato of contratos) {
      if (!contrato.diaVencimento) continue; // sem dia de vencimento definido, nao ha como gerar

      // Mes atual, ou proximo mes se o dia de vencimento deste mes ja passou.
      let vencimentoAlvo = computeVencimentoNoMes(contrato.diaVencimento, hoje);
      if (vencimentoAlvo < hoje) {
        const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        vencimentoAlvo = computeVencimentoNoMes(contrato.diaVencimento, proximoMes);
      }

      const jaExiste = await this.lancamentoRepository.existsForContratoAndPeriodo({
        contratoId: contrato.id,
        tipo: TIPO_RECEITA,
        categoria: CATEGORIA_ALUGUEL,
        vencimentoDe: startOfMonth(vencimentoAlvo),
        vencimentoAte: endOfMonth(vencimentoAlvo),
      });
      if (jaExiste) continue;

      await this.lancamentoRepository.create({
        tenantId: input.tenantId,
        contratoId: contrato.id,
        tipo: TIPO_RECEITA,
        categoria: CATEGORIA_ALUGUEL,
        valor: contrato.valor,
        vencimento: vencimentoAlvo,
        descricao: `Aluguel referente a ${String(vencimentoAlvo.getMonth() + 1).padStart(2, '0')}/${vencimentoAlvo.getFullYear()}`,
      });
      criados++;
    }

    return { criados };
  }
}
