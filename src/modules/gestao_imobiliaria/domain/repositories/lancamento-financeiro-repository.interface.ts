// src/modules/gestao_imobiliaria/domain/repositories/lancamento-financeiro-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface LancamentoFinanceiroRecord {
  id: string;
  tenantId: string;
  contratoId: string | null;
  tipo: string;
  categoria: string;
  valor: number;
  vencimento: Date;
  status: string;
  pagoEm: Date | null;
  descricao: string | null;
  createdAt: Date;
}

export interface LancamentoFinanceiroFilters {
  tipo?: string;
  status?: string;
  contratoId?: string;
  vencimentoDe?: Date;
  vencimentoAte?: Date;
}

export interface ILancamentoFinanceiroRepository {
  create(input: {
    tenantId: string;
    contratoId?: string | null;
    tipo: string;
    categoria: string;
    valor: number;
    vencimento: Date;
    descricao?: string | null;
  }): Promise<LancamentoFinanceiroRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<LancamentoFinanceiroRecord | null>;
  findAllByTenant(
    tenantId: string,
    filters?: LancamentoFinanceiroFilters,
  ): Promise<LancamentoFinanceiroRecord[]>;
  markAsPago(id: string, pagoEm: Date): Promise<LancamentoFinanceiroRecord>;
  // Usado por GerarCobrancasDoMesUseCase para nao duplicar: ja existe um
  // lancamento desse tipo/categoria para esse contrato com vencimento
  // dentro do intervalo informado (mes-alvo calculado pelo caso de uso)?
  existsForContratoAndPeriodo(input: {
    contratoId: string;
    tipo: string;
    categoria: string;
    vencimentoDe: Date;
    vencimentoAte: Date;
  }): Promise<boolean>;
  // Usado por AtualizarStatusVencidosUseCase - retorna quantos foram atualizados.
  updateManyStatusToAtrasado(tenantId: string, vencimentoAntesDe: Date): Promise<number>;
}
