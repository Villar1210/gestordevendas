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
    faixaPelaRenda: FaixaMcmv | null; // null = renda acima da Faixa 4
    rotuloFaixaPelaRenda: string;
    tetoFaixaPelaRenda: number | null;
    enquadra: boolean;
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

// Renda necessaria com juros da faixa em que a propria renda cai (iterativo:
// comeca pela faixa do preco; no maximo 4 voltas - converge porque juros maior
// so empurra para faixa maior).
export function calcularFinanciamento(preco: number, p: Premissas, mcmv: VersaoMcmv) {
  const entrada = preco * (p.entradaPercentual / 100);
  const financiado = preco - entrada;
  const calc = (juros: number) => {
    const parcela = parcelaPrice(financiado, juros, p.prazoMeses);
    return { juros, parcela, renda: parcela / (p.comprometimentoPercentual / 100) };
  };
  if (p.jurosAnual !== null) {
    const r = calc(p.jurosAnual);
    return { entrada, financiado, ...r };
  }
  let juros = faixaPorPreco(preco, mcmv)?.jurosReferenciaAnual ?? mcmv.jurosForaAnual;
  let r = calc(juros);
  for (let volta = 0; volta < 4; volta++) {
    const novo = faixaPorRenda(r.renda, mcmv)?.jurosReferenciaAnual ?? mcmv.jurosForaAnual;
    if (novo === juros) break;
    juros = novo;
    r = calc(juros);
  }
  return { entrada, financiado, ...r };
}

export function avaliarTipologia(t: TipologiaViabilidade, p: Premissas, mun: VersaoMunicipal, mcmv: VersaoMcmv): ResultadoTipologia {
  const fin = calcularFinanciamento(t.preco, p, mcmv);
  const renda = arredondar2(fin.renda);
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
  const pelaRenda = faixaPorRenda(renda, mcmv);
  const enquadra = !!pelaRenda && t.preco <= pelaRenda.tetoImovel;
  if (!pelaRenda) {
    const f4 = mcmv.faixas[mcmv.faixas.length - 1];
    avisos.push(`A renda necessária (${moeda(renda)}) passa do limite da ${f4.rotulo} (${moeda(f4.rendaMax)}): financiamento fora do MCMV (SBPE).`);
  } else if (!enquadra) {
    avisos.push(
      `A renda necessária cai na ${pelaRenda.rotulo}, cujo teto (${moedaMil(pelaRenda.tetoImovel)}) não cobre o preço (${moeda(t.preco)}).`,
    );
  }

  let situacao: Situacao;
  if (!cat && !enquadra) situacao = 'fora';
  else if (enquadra && (cat === null ? true : rendaDentro === true)) situacao = cat === null ? 'atencao' : 'ok';
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
      faixaPelaRenda: pelaRenda?.faixa ?? null,
      rotuloFaixaPelaRenda: pelaRenda?.rotulo ?? 'Fora do MCMV',
      tetoFaixaPelaRenda: pelaRenda?.tetoImovel ?? null,
      enquadra,
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
