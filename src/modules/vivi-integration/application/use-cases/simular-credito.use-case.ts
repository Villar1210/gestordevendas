// src/modules/vivi-integration/application/use-cases/simular-credito.use-case.ts
import { Injectable } from '@nestjs/common';
import { getFaixaEtaria, buscarLinhaTabela } from '../../data/tabela-financiamento';

export interface SimularCreditoInput {
  renda: number;
  idade: number;
  temDependente?: boolean;
}

export interface SimularCreditoResult {
  elegivel: boolean;
  motivoNaoElegivel?: string;
  faixaRenda?: string;
  faixaEtaria?: string;
  financiamento?: number;
  subsidio?: number;
  primeiraParcela?: number;
  taxaEfetiva?: number;
  tetoAvaliacao?: number;
  temRedutor?: boolean;
  resumoTexto: string;
}

@Injectable()
export class SimularCreditoUseCase {
  execute(input: SimularCreditoInput): SimularCreditoResult {
    const { renda, idade, temDependente = false } = input;

    if (idade < 21 || idade > 60) {
      return {
        elegivel: false,
        motivoNaoElegivel: `Idade ${idade} anos fora da faixa elegível (21 a 60 anos).`,
        resumoTexto:
          `❌ *Simulação de Crédito MCMV*\n\n` +
          `Com ${idade} anos o cliente não se enquadra no programa (faixa: 21 a 60 anos).`,
      };
    }

    if (renda < 1700) {
      return {
        elegivel: false,
        motivoNaoElegivel: 'Renda abaixo do mínimo do programa (R$ 1.700).',
        resumoTexto:
          `❌ *Simulação de Crédito MCMV*\n\n` +
          `Renda de R$ ${renda.toLocaleString('pt-BR')} está abaixo do mínimo (R$ 1.700).`,
      };
    }

    if (renda > 25000) {
      return {
        elegivel: false,
        motivoNaoElegivel: 'Renda acima do teto do programa (R$ 25.000).',
        resumoTexto:
          `❌ *Simulação de Crédito MCMV*\n\n` +
          `Renda de R$ ${renda.toLocaleString('pt-BR')} está acima do teto do programa (R$ 25.000).`,
      };
    }

    const faixaEtaria = getFaixaEtaria(idade);
    if (!faixaEtaria) {
      return {
        elegivel: false,
        motivoNaoElegivel: 'Faixa etária não encontrada.',
        resumoTexto: '❌ Não foi possível calcular para a idade informada.',
      };
    }

    const linha = buscarLinhaTabela(renda, faixaEtaria);
    if (!linha) {
      return {
        elegivel: false,
        motivoNaoElegivel: 'Linha não encontrada na tabela.',
        resumoTexto: '❌ Não foi possível calcular para os dados informados.',
      };
    }

    const temRedutor = linha.taxaComRedutor !== null && linha.financiamentoComRedutor !== null;
    const financiamento = temRedutor
      ? (linha.financiamentoComRedutor ?? linha.financiamentoSemRedutor ?? 0)
      : (linha.financiamentoSemRedutor ?? 0);
    const taxa = temRedutor
      ? (linha.taxaComRedutor ?? linha.taxaSemRedutor ?? 0)
      : (linha.taxaSemRedutor ?? 0);
    const subsidio = temDependente
      ? (linha.subsidioComDependente ?? 0)
      : (linha.subsidioSemDependente ?? 0);

    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtPct = (v: number) =>
      (v * 100).toFixed(2).replace('.', ',') + '% a.a.';

    const partes: string[] = [
      `✅ *Simulação de Crédito – Minha Casa Minha Vida*`,
      ``,
      `👤 Perfil: ${idade} anos | Renda: ${fmt(renda)}`,
      `📋 Faixa de renda: ${linha.faixaRenda ?? 'N/A'}`,
      ``,
      `💰 *Valor de financiamento:* ${fmt(financiamento)}`,
    ];
    if (subsidio > 0) {
      partes.push(`🎁 *Subsídio:* ${fmt(subsidio)}`);
      partes.push(`🏠 *Valor total estimado do imóvel:* ${fmt(financiamento + subsidio)}`);
    }
    partes.push(`📉 *Taxa efetiva:* ${fmtPct(taxa)}${temRedutor ? ' (com redutor social)' : ''}`);
    partes.push(`💳 *1ª parcela estimada:* ${fmt(linha.primeiraParcela ?? 0)}`);
    if (linha.tetoAvaliacao) {
      partes.push(`🏷️ *Teto de avaliação:* ${fmt(linha.tetoAvaliacao)}`);
    }

    return {
      elegivel: true,
      faixaRenda: linha.faixaRenda ?? undefined,
      faixaEtaria,
      financiamento,
      subsidio: subsidio > 0 ? subsidio : undefined,
      primeiraParcela: linha.primeiraParcela ?? undefined,
      taxaEfetiva: taxa,
      tetoAvaliacao: linha.tetoAvaliacao ?? undefined,
      temRedutor,
      resumoTexto: partes.join('\n'),
    };
  }
}
