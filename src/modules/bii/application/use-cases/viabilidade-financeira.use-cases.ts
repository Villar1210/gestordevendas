// src/modules/bii/application/use-cases/viabilidade-financeira.use-cases.ts
// Fatia 7 - Viabilidade financeira (resultado final do empreendimento). So
// Administrador (checado aqui tambem). So calcula: nao grava nada e nao chama
// servico externo - liberado na impersonacao do Super Usuario, como a Fatia 4.
// Contrato: docs/bii/fatia7/CONTRATO_VIABILIDADE_FINANCEIRA.md
import { BadRequestException, Injectable } from '@nestjs/common';
import { formatarDataUtc, hojeUtc } from '../../domain/services/data-utc';
import { limparTextoCurto } from '../../domain/services/concorrente';
import { VERSOES_MCMV, versaoVigente } from '../../domain/services/parametros-habitacionais';
import { VERSOES_CUB, VersaoCub } from '../../domain/services/referencia-cub';
import {
  calcularResultadoFinanceiro,
  IMPOSTO_POR_REGIME,
  PADROES_FINANCEIROS,
  PremissasFinanceiras,
  RegimeImposto,
  ResultadoFinanceiro,
  ROTULO_REGIME,
  TipologiaFinanceira,
  validarEntradaFinanceira,
} from '../../domain/services/viabilidade-financeira';
import { exigirAdministrador } from './permissoes-bii';

export const OBSERVACAO_FINANCEIRO =
  'Estimativa do resultado final do empreendimento, sem fluxo de caixa, juros de obra nem correção pelo INCC. Impostos e custos de cartório são aproximados: confirme com o contador.';
export const MENSAGEM_CUSTO_OBRA_OBRIGATORIO = 'Informe o custo de obra em R$/m² de área construída.';
export const MENSAGEM_IMPOSTO_OUTRO = 'Com "Outro percentual", informe o imposto em % do VGV.';

export interface PremissasFinanceirasEntrada {
  terreno?: Partial<PremissasFinanceiras['terreno']>;
  obra?: Partial<PremissasFinanceiras['obra']>;
  comercial?: Partial<PremissasFinanceiras['comercial']>;
  margemAlvoPercentual?: number;
}

export interface ViabilidadeFinanceiraResposta extends ResultadoFinanceiro {
  observacao: string;
}

function cubVigente(agora: Date): VersaoCub {
  return versaoVigente(VERSOES_CUB, formatarDataUtc(hojeUtc(agora)));
}

export function resolverPremissasFinanceiras(e: PremissasFinanceirasEntrada | undefined): PremissasFinanceiras {
  const custoM2 = e?.obra?.custoM2;
  if (typeof custoM2 !== 'number' || !Number.isFinite(custoM2)) throw new BadRequestException(MENSAGEM_CUSTO_OBRA_OBRIGATORIO);
  const regime: RegimeImposto = e?.comercial?.impostoRegime ?? PADROES_FINANCEIROS.comercial.impostoRegime;
  let impostoPercentual: number;
  if (regime === 'outro') {
    const v = e?.comercial?.impostoPercentual;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new BadRequestException(MENSAGEM_IMPOSTO_OUTRO);
    impostoPercentual = v;
  } else {
    // ret4/ret1: o percentual e o do regime (um valor digitado e ignorado)
    impostoPercentual = IMPOSTO_POR_REGIME[regime];
  }
  const P = PADROES_FINANCEIROS;
  return {
    terreno: {
      valorCompra: e?.terreno?.valorCompra ?? P.terreno.valorCompra,
      itbiPercentual: e?.terreno?.itbiPercentual ?? P.terreno.itbiPercentual,
      escrituraRegistroPercentual: e?.terreno?.escrituraRegistroPercentual ?? P.terreno.escrituraRegistroPercentual,
      permutaPercentual: e?.terreno?.permutaPercentual ?? P.terreno.permutaPercentual,
    },
    obra: {
      custoM2,
      areaConstruida: e?.obra?.areaConstruida ?? null,
      fatorAreaConstruida: e?.obra?.fatorAreaConstruida ?? P.obra.fatorAreaConstruida,
      indiretosPercentual: e?.obra?.indiretosPercentual ?? P.obra.indiretosPercentual,
      contingenciaPercentual: e?.obra?.contingenciaPercentual ?? P.obra.contingenciaPercentual,
    },
    comercial: {
      impostoRegime: regime,
      impostoPercentual,
      comissaoPercentual: e?.comercial?.comissaoPercentual ?? P.comercial.comissaoPercentual,
      marketingPercentual: e?.comercial?.marketingPercentual ?? P.comercial.marketingPercentual,
    },
    margemAlvoPercentual: e?.margemAlvoPercentual ?? P.margemAlvoPercentual,
  };
}

// Calculo puro reaproveitado pelo Estudo de terreno (Fatia 5). Erros -> 400.
export function calcularViabilidadeFinanceira(
  tipologias: TipologiaFinanceira[],
  entrada: PremissasFinanceirasEntrada | undefined,
  agora: Date,
): ViabilidadeFinanceiraResposta {
  if (!tipologias.length || tipologias.length > 20) throw new BadRequestException('Informe de 1 a 20 tipologias.');
  const limpas = tipologias.map((t) => ({
    descricao: limparTextoCurto(t.descricao).slice(0, 100) || 'Tipologia',
    areaPrivativa: t.areaPrivativa,
    preco: t.preco,
    quantidade: t.quantidade,
  }));
  const premissas = resolverPremissasFinanceiras(entrada);
  const erro = validarEntradaFinanceira(limpas, premissas);
  if (erro) throw new BadRequestException(erro);
  const data = formatarDataUtc(hojeUtc(agora));
  const r = calcularResultadoFinanceiro(limpas, premissas, cubVigente(agora), versaoVigente(VERSOES_MCMV, data));
  return { ...r, observacao: OBSERVACAO_FINANCEIRO };
}

@Injectable()
export class GetParametrosFinanceirosUseCase {
  execute(input: { requesterRole: string; agora?: Date }) {
    exigirAdministrador(input.requesterRole);
    return {
      padroes: PADROES_FINANCEIROS,
      regimesImposto: (Object.keys(ROTULO_REGIME) as RegimeImposto[]).map((v) => ({
        valor: v,
        rotulo: ROTULO_REGIME[v],
        percentual: v === 'outro' ? null : IMPOSTO_POR_REGIME[v],
      })),
      cub: cubVigente(input.agora ?? new Date()),
      observacao: OBSERVACAO_FINANCEIRO,
    };
  }
}

@Injectable()
export class CalcularViabilidadeFinanceiraUseCase {
  execute(input: {
    requesterRole: string;
    tipologias: TipologiaFinanceira[];
    premissas?: PremissasFinanceirasEntrada;
    agora?: Date;
  }): ViabilidadeFinanceiraResposta {
    exigirAdministrador(input.requesterRole);
    return calcularViabilidadeFinanceira(input.tipologias, input.premissas, input.agora ?? new Date());
  }
}
