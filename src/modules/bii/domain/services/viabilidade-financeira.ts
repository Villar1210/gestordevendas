// src/modules/bii/domain/services/viabilidade-financeira.ts
// Fatia 7 - resultado final do empreendimento: VGV, deducoes (imposto,
// comissao, marketing), custos (terreno, obra, indiretos, contingencia),
// lucro, margens e VALOR MAXIMO DO TERRENO para uma margem-alvo, com terreno
// em permuta opcional (% do VGV em unidades). Funcoes PURAS.
// Contrato: docs/bii/fatia7/CONTRATO_VIABILIDADE_FINANCEIRA.md
import { arredondar1, arredondar2 } from './estatistica';
import type { VersaoMcmv } from './parametros-habitacionais';
import type { VersaoCub } from './referencia-cub';
import { faixaPorPreco } from './viabilidade';

export interface TipologiaFinanceira {
  descricao: string;
  areaPrivativa: number;
  preco: number;
  quantidade: number;
}

export type RegimeImposto = 'ret4' | 'ret1' | 'outro';
export const IMPOSTO_POR_REGIME: Record<Exclude<RegimeImposto, 'outro'>, number> = { ret4: 4, ret1: 1 };
export const ROTULO_REGIME: Record<RegimeImposto, string> = {
  ret4: 'RET 4% (padrão)',
  ret1: 'RET 1% (MCMV / HIS)',
  outro: 'Outro percentual',
};

export interface PremissasFinanceiras {
  terreno: {
    valorCompra: number;
    itbiPercentual: number;
    escrituraRegistroPercentual: number;
    permutaPercentual: number;
  };
  obra: {
    custoM2: number;
    areaConstruida: number | null; // null = area privativa total x fator
    fatorAreaConstruida: number;
    indiretosPercentual: number;
    contingenciaPercentual: number;
  };
  comercial: {
    impostoRegime: RegimeImposto;
    impostoPercentual: number; // efetivo (ret4 = 4, ret1 = 1, outro = digitado)
    comissaoPercentual: number;
    marketingPercentual: number;
  };
  margemAlvoPercentual: number;
}

// Padroes editaveis (custoM2 nao tem padrao: obrigatorio).
export const PADROES_FINANCEIROS = {
  terreno: { valorCompra: 0, itbiPercentual: 3, escrituraRegistroPercentual: 1, permutaPercentual: 0 },
  obra: { areaConstruida: null as number | null, fatorAreaConstruida: 1.6, indiretosPercentual: 10, contingenciaPercentual: 5 },
  comercial: { impostoRegime: 'ret4' as RegimeImposto, comissaoPercentual: 5, marketingPercentual: 3 },
  margemAlvoPercentual: 15,
};

export type SituacaoFinanceira = 'viavel' | 'apertado' | 'inviavel';

export interface ResultadoFinanceiro {
  premissas: PremissasFinanceiras;
  tipologias: Array<TipologiaFinanceira & { vgv: number; areaPrivativaTotal: number }>;
  areas: { unidades: number; privativaTotal: number; construida: number; fatorEfetivo: number; construidaInformada: boolean };
  vgv: { total: number; permuta: number; vendavel: number };
  deducoes: { imposto: number; comissao: number; marketing: number; total: number };
  receitaLiquida: number;
  custos: {
    terreno: { compra: number; itbi: number; escrituraRegistro: number; total: number };
    obra: number;
    indiretos: number;
    contingencia: number;
    total: number;
  };
  resultado: {
    lucro: number;
    margemVgvPercentual: number; // lucro / VGV vendavel
    margemCustoPercentual: number | null; // lucro / custo total
    pesoTerrenoPercentual: number; // (terreno + permuta) / VGV total
    custoM2Privativo: number;
    custoObraM2Privativo: number;
    valorMaximoTerreno: number | null; // null = nem de graca chega na margem-alvo
    situacao: SituacaoFinanceira;
  };
  referenciaCub: { rotulo: string; mesReferencia: string; valorM2: number; fonte: string; observacao: string; razaoCustoCub: number };
  avisos: string[];
}

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/ /g, ' ');
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function areaPrivativaTotal(tipologias: TipologiaFinanceira[]): number {
  return tipologias.reduce((s, t) => s + t.areaPrivativa * t.quantidade, 0);
}

// null = ok; texto = motivo da recusa (o caso de uso vira 400).
export function validarEntradaFinanceira(tipologias: TipologiaFinanceira[], p: PremissasFinanceiras): string | null {
  if (!tipologias.length) return 'Informe ao menos uma tipologia com quantidade.';
  const privativa = areaPrivativaTotal(tipologias);
  if (p.obra.areaConstruida !== null && p.obra.areaConstruida < privativa) {
    const m2 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
    return `A área construída informada (${m2(p.obra.areaConstruida)}) não pode ser menor que a soma das áreas privativas das unidades (${m2(privativa)}).`;
  }
  return null;
}

export function calcularResultadoFinanceiro(
  tipologias: TipologiaFinanceira[],
  p: PremissasFinanceiras,
  cub: VersaoCub,
  mcmv: VersaoMcmv,
): ResultadoFinanceiro {
  const avisos: string[] = [];
  const frac = (v: number) => v / 100;

  // areas e VGV
  const linhas = tipologias.map((t) => ({ ...t, vgv: t.preco * t.quantidade, areaPrivativaTotal: t.areaPrivativa * t.quantidade }));
  const unidades = linhas.reduce((s, t) => s + t.quantidade, 0);
  const privativa = linhas.reduce((s, t) => s + t.areaPrivativaTotal, 0);
  const construidaInformada = p.obra.areaConstruida !== null;
  const construida = construidaInformada ? (p.obra.areaConstruida as number) : privativa * p.obra.fatorAreaConstruida;
  const vgvTotal = linhas.reduce((s, t) => s + t.vgv, 0);
  const vgvPermuta = vgvTotal * frac(p.terreno.permutaPercentual);
  const vgvVendavel = vgvTotal - vgvPermuta;

  // deducoes sobre o que sera vendido
  const imposto = vgvVendavel * frac(p.comercial.impostoPercentual);
  const comissao = vgvVendavel * frac(p.comercial.comissaoPercentual);
  const marketing = vgvVendavel * frac(p.comercial.marketingPercentual);
  const deducoes = imposto + comissao + marketing;
  const receitaLiquida = vgvVendavel - deducoes;

  // custos
  const fatorTerreno = 1 + frac(p.terreno.itbiPercentual) + frac(p.terreno.escrituraRegistroPercentual);
  const compra = p.terreno.valorCompra;
  const itbi = compra * frac(p.terreno.itbiPercentual);
  const escritura = compra * frac(p.terreno.escrituraRegistroPercentual);
  const terreno = compra * fatorTerreno;
  const obra = construida * p.obra.custoM2;
  const indiretos = obra * frac(p.obra.indiretosPercentual);
  const contingencia = obra * frac(p.obra.contingenciaPercentual);
  const custoSemTerreno = obra + indiretos + contingencia;
  const custoTotal = terreno + custoSemTerreno;

  // resultado
  const lucro = receitaLiquida - custoTotal;
  const margemVgvBruta = (lucro / vgvVendavel) * 100;
  const margemVgv = arredondar1(margemVgvBruta);
  const margemCusto = custoTotal > 0 ? arredondar1((lucro / custoTotal) * 100) : null;
  const pesoTerreno = arredondar1(((terreno + vgvPermuta) / vgvTotal) * 100);
  const alvo = p.margemAlvoPercentual;
  const maxBruto = (receitaLiquida - custoSemTerreno - frac(alvo) * vgvVendavel) / fatorTerreno;
  // >= 0: com terreno de graca a margem fica exatamente no alvo
  const valorMaximoTerreno = maxBruto >= 0 ? arredondar2(maxBruto) : null;

  // situacao pela margem SEM arredondar (revisao: 14,96% arredondava para 15,0%
  // e saia "viavel" junto com o aviso de terreno acima do maximo). Folga de
  // 1e-9 so para absorver erro de ponto flutuante na fronteira exata.
  let situacao: SituacaoFinanceira;
  if (lucro < 0) situacao = 'inviavel';
  else if (margemVgvBruta >= alvo - 1e-9) situacao = 'viavel';
  else situacao = 'apertado';
  const baseMargem = p.terreno.permutaPercentual > 0 ? 'do VGV vendável' : 'do VGV';

  // avisos
  if (p.obra.custoM2 < cub.valorM2) {
    avisos.push(
      `O custo de obra informado (${moeda(p.obra.custoM2)}/m²) está abaixo do CUB-SP de referência (${moeda(cub.valorM2)}/m²). ${cub.observacao}`,
    );
  }
  if (p.comercial.impostoRegime === 'ret1') {
    const fora = tipologias.filter((t) => !faixaPorPreco(t.preco, mcmv)).map((t) => t.descricao);
    if (fora.length) {
      avisos.push(`RET 1% escolhido, mas ${fora.length === 1 ? 'a tipologia' : 'as tipologias'} ${fora.join(', ')} não cabe(m) no MCMV pelo preço: confirme o regime com o contador.`);
    }
    avisos.push('O RET 1% vale só para as unidades enquadradas no programa habitacional (RET-MCMV): confirme com o contador quais unidades entram.');
  }
  if (p.terreno.permutaPercentual > 0) {
    avisos.push(
      'Imposto, comissão e marketing foram calculados só sobre as unidades vendidas. A unidade dada em permuta também tem tributação: confirme com o contador.',
    );
  }
  if (situacao === 'inviavel') {
    avisos.push(`Prejuízo estimado de ${moeda(Math.abs(lucro))}: os custos passam da receita líquida.`);
  } else if (situacao === 'apertado') {
    avisos.push(`A margem (${pct(margemVgv)} ${baseMargem}) está abaixo da margem desejada (${pct(alvo)}).`);
  }
  if (valorMaximoTerreno === null) {
    avisos.push(`Mesmo com o terreno de graça a margem não chega a ${pct(alvo)} ${baseMargem} com essas premissas.`);
  } else if (compra > valorMaximoTerreno) {
    avisos.push(`O valor de compra do terreno (${moeda(compra)}) passa do máximo para ${pct(alvo)} de margem (${moeda(valorMaximoTerreno)}).`);
  }

  return {
    premissas: p,
    tipologias: linhas.map((t) => ({ ...t, vgv: arredondar2(t.vgv), areaPrivativaTotal: arredondar2(t.areaPrivativaTotal) })),
    areas: {
      unidades,
      privativaTotal: arredondar2(privativa),
      construida: arredondar2(construida),
      fatorEfetivo: Math.round((construida / privativa) * 100) / 100,
      construidaInformada,
    },
    vgv: { total: arredondar2(vgvTotal), permuta: arredondar2(vgvPermuta), vendavel: arredondar2(vgvVendavel) },
    deducoes: { imposto: arredondar2(imposto), comissao: arredondar2(comissao), marketing: arredondar2(marketing), total: arredondar2(deducoes) },
    receitaLiquida: arredondar2(receitaLiquida),
    custos: {
      terreno: { compra: arredondar2(compra), itbi: arredondar2(itbi), escrituraRegistro: arredondar2(escritura), total: arredondar2(terreno) },
      obra: arredondar2(obra),
      indiretos: arredondar2(indiretos),
      contingencia: arredondar2(contingencia),
      total: arredondar2(custoTotal),
    },
    resultado: {
      lucro: arredondar2(lucro),
      margemVgvPercentual: margemVgv,
      margemCustoPercentual: margemCusto,
      pesoTerrenoPercentual: pesoTerreno,
      custoM2Privativo: arredondar2(custoTotal / privativa),
      custoObraM2Privativo: arredondar2(obra / privativa),
      valorMaximoTerreno,
      situacao,
    },
    referenciaCub: {
      rotulo: cub.rotulo,
      mesReferencia: cub.mesReferencia,
      valorM2: cub.valorM2,
      fonte: cub.fonte,
      observacao: cub.observacao,
      razaoCustoCub: Math.round((p.obra.custoM2 / cub.valorM2) * 100) / 100,
    },
    avisos,
  };
}
