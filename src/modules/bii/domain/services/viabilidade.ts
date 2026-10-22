// src/modules/bii/domain/services/viabilidade.ts
// Fatia 4 - enquadramento HIS/HMP (municipal) e MCMV (federal) de cada
// tipologia + renda necessaria estimada (Tabela Price). Funcoes PURAS.
// Contrato: docs/bii/fatia4/CONTRATO_VIABILIDADE.md
import { arredondar1, arredondar2 } from './estatistica';
import type {
  CategoriaMunicipal,
  FaixaMcmv,
  ParametroMcmv,
  VersaoMcmv,
  VersaoMunicipal,
} from './parametros-habitacionais';

export interface TipologiaViabilidade {
  descricao: string;
  areaPrivativa: number;
  preco: number;
}

export interface Premissas {
  entradaPercentual: number; // 0-90
  prazoMeses: number; // 60-420
  comprometimentoPercentual: number; // 10-50
  jurosAnual: number | null; // null = referencia da faixa
}

export const PREMISSAS_PADRAO: Premissas = {
  entradaPercentual: 20,
  prazoMeses: 420,
  comprometimentoPercentual: 30,
  jurosAnual: null,
};

export type Situacao = 'ok' | 'atencao' | 'fora';

export interface ResultadoTipologia {
  descricao: string;
  areaPrivativa: number;
  preco: number;
  precoM2: number;
  municipal: {
    categoria: CategoriaMunicipal | 'MERCADO';
    rotulo: string;
    teto: number | null;
    folga: number | null; // teto - preco
    folgaPercentual: number | null; // folga / teto * 100
    rendaMax: number | null;
    rendaDentro: boolean | null; // renda necessaria <= renda maxima da categoria
  };
  mcmv: {
    faixaPeloPreco: FaixaMcmv | null; // menor faixa cujo teto cobre o preco
    faixaPelaRenda: FaixaMcmv | null; // faixa em que o comprador financia; null = fora do MCMV
    rotuloFaixaPelaRenda: string;
    tetoFaixaPelaRenda: number | null;
    enquadra: boolean;
    rendaPeloPiso: boolean; // renda minima veio do piso da faixa, nao da parcela
  };
  financiamento: {
    valorFinanciado: number;
    entrada: number;
    jurosAnual: number;
    parcela: number;
    rendaNecessaria: number;
  };
  situacao: Situacao;
  avisos: string[];
}

const moeda = (v: number) =>
  v
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 })
    .replace(/\u00a0/g, ' ');
const moedaMil = (v: number) => (v >= 1000 && v % 1000 === 0 ? `R$ ${(v / 1000).toLocaleString('pt-BR')} mil` : moeda(v));

// Parcela da Tabela Price. Juros anual efetivo -> mensal equivalente.
export function parcelaPrice(valor: number, jurosAnualPct: number, meses: number): number {
  if (valor <= 0) return 0;
  const i = Math.pow(1 + jurosAnualPct / 100, 1 / 12) - 1;
  if (i === 0) return valor / meses;
  return (valor * i) / (1 - Math.pow(1 + i, -meses));
}

export function faixaPorRenda(renda: number, mcmv: VersaoMcmv): ParametroMcmv | null {
  return mcmv.faixas.find((f) => renda <= f.rendaMax) ?? null;
}

export function faixaPorPreco(preco: number, mcmv: VersaoMcmv): ParametroMcmv | null {
  return mcmv.faixas.find((f) => preco <= f.tetoImovel) ?? null;
}

// Enquadramento no MCMV + renda necessaria (minima do comprador).
// Percorre, em ordem crescente, as faixas cujo TETO cobre o preco: em cada
// uma calcula a renda pela parcela (juros da faixa, ou a taxa fixa) e a eleva
// ao PISO da faixa (rendaMin) se ficar abaixo - quem ganha menos que o piso
// esta numa faixa cujo teto nao cobre o preco. A primeira faixa em que essa
// renda cabe (<= rendaMax) e a resposta. Nenhuma -> fora do MCMV (SBPE ou
// taxa fixa). Renda arredondada ANTES de comparar com as fronteiras.
export function calcularFinanciamento(preco: number, p: Premissas, mcmv: VersaoMcmv) {
  const entrada = preco * (p.entradaPercentual / 100);
  const financiado = preco - entrada;
  const calc = (juros: number) => {
    const parcela = parcelaPrice(financiado, juros, p.prazoMeses);
    return { juros, parcela, rendaPelaParcela: arredondar2(parcela / (p.comprometimentoPercentual / 100)) };
  };
  for (const f of mcmv.faixas) {
    if (preco > f.tetoImovel) continue;
    const r = calc(p.jurosAnual ?? f.jurosReferenciaAnual);
    const renda = Math.max(r.rendaPelaParcela, f.rendaMin);
    if (renda <= f.rendaMax) {
      return { entrada, financiado, ...r, renda, faixa: f as ParametroMcmv | null, pelaPiso: renda > r.rendaPelaParcela };
    }
  }
  const r = calc(p.jurosAnual ?? mcmv.jurosForaAnual);
  return { entrada, financiado, ...r, renda: r.rendaPelaParcela, faixa: null as ParametroMcmv | null, pelaPiso: false };
}

export function avaliarTipologia(t: TipologiaViabilidade, p: Premissas, mun: VersaoMunicipal, mcmv: VersaoMcmv): ResultadoTipologia {
  const fin = calcularFinanciamento(t.preco, p, mcmv);
  const renda = fin.renda;
  const avisos: string[] = [];

  const cat = mun.categorias.find((c) => t.preco <= c.tetoVenda) ?? null;
  const rendaDentro = cat ? renda <= cat.rendaMax : null;
  if (cat && rendaDentro === false) {
    avisos.push(
      `O preço cabe no teto ${cat.rotulo}, mas a renda necessária (${moeda(renda)}) passa do limite de renda ${cat.rotulo} (${moeda(cat.rendaMax)}).`,
    );
  }
  if (!cat) {
    const hmp = mun.categorias[mun.categorias.length - 1];
    avisos.push(`O preço passa do teto HMP (${moeda(hmp.tetoVenda)}): produto de mercado, fora das categorias da Prefeitura.`);
  }

  const peloPreco = faixaPorPreco(t.preco, mcmv);
  const faixa = fin.faixa;
  const enquadra = faixa !== null;
  if (!peloPreco) {
    const f4 = mcmv.faixas[mcmv.faixas.length - 1];
    avisos.push(`O preço passa do teto da ${f4.rotulo} (${moedaMil(f4.tetoImovel)}): financiamento fora do MCMV (SBPE).`);
  } else if (!enquadra) {
    const ultima = mcmv.faixas[mcmv.faixas.length - 1];
    avisos.push(
      `A renda necessária (${moeda(renda)}) passa do limite de renda da ${ultima.rotulo} (${moeda(ultima.rendaMax)}): com essas premissas o financiamento sai do MCMV (SBPE).`,
    );
  } else if (fin.pelaPiso) {
    avisos.push(
      `Pela parcela bastaria renda de ${moeda(fin.rendaPelaParcela)}, mas o preço só cabe a partir da ${faixa.rotulo}, que começa em ${moeda(Math.ceil(faixa.rendaMin))}: essa é a renda mínima do comprador.`,
    );
  }

  // ok = enquadra no MCMV E e HIS/HMP com a renda dentro; acima de HMP que
  // enquadra no MCMV (Faixa 4) fica "atencao" de proposito: perde os
  // incentivos municipais de HIS/HMP. fora = acima de HMP e fora do MCMV.
  let situacao: Situacao;
  if (!cat && !enquadra) situacao = 'fora';
  else if (enquadra && cat !== null && rendaDentro === true) situacao = 'ok';
  else situacao = 'atencao';

  const folga = cat ? arredondar2(cat.tetoVenda - t.preco) : null;
  return {
    descricao: t.descricao,
    areaPrivativa: t.areaPrivativa,
    preco: t.preco,
    precoM2: arredondar2(t.preco / t.areaPrivativa),
    municipal: {
      categoria: cat?.categoria ?? 'MERCADO',
      rotulo: cat?.rotulo ?? 'Mercado (acima de HMP)',
      teto: cat?.tetoVenda ?? null,
      folga,
      folgaPercentual: cat && folga !== null ? arredondar1((folga / cat.tetoVenda) * 100) : null,
      rendaMax: cat?.rendaMax ?? null,
      rendaDentro,
    },
    mcmv: {
      faixaPeloPreco: peloPreco?.faixa ?? null,
      faixaPelaRenda: faixa?.faixa ?? null,
      rotuloFaixaPelaRenda: faixa?.rotulo ?? 'Fora do MCMV',
      tetoFaixaPelaRenda: faixa?.tetoImovel ?? null,
      enquadra,
      rendaPeloPiso: fin.pelaPiso,
    },
    financiamento: {
      valorFinanciado: arredondar2(fin.financiado),
      entrada: arredondar2(fin.entrada),
      jurosAnual: fin.juros,
      parcela: arredondar2(fin.parcela),
      rendaNecessaria: renda,
    },
    situacao,
    avisos,
  };
}
