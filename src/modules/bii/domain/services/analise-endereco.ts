// src/modules/bii/domain/services/analise-endereco.ts
// Calculo da analise por endereco sobre as transacoes do ITBI que vieram do
// bounding box (contrato: docs/bii/fatia2/CONTRATO_ANALISE_ENDERECO.md).
// Funcao PURA: recebe as linhas ja lidas, corta pelo raio (haversine), separa
// "na planta", aplica tipo/area e calcula as estatisticas.
import { arredondar2, mediana, percentil } from './estatistica';
import { distanciaMetros, GeoPonto } from './geo';
import { chaveMesUtc, formatarDataUtc, mesesDoPeriodoUtc } from './data-utc';
import {
  categoriaFinanciamento,
  ehUnidadeNaPlanta,
  NATUREZA_COMPRA_E_VENDA,
  precoM2,
  precoM2Plausivel,
  TipoImovelAnalise,
  usosDoTipo,
  usosPrecoM2,
} from './itbi-classificacao';

export const MAX_AMOSTRA = 200;

export interface TransacaoParaAnalise {
  dataTransacao: Date; // meia-noite UTC
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  areaConstruida: number | null;
  valorTransacao: number;
  latitude: number;
  longitude: number;
  usoIptu: number | null;
  naturezaCodigo: number | null;
  tipoFinanciamentoCodigo: number | null;
  tipoFinanciamento: string | null;
}

export interface ParametrosCalculo {
  centro: GeoPonto;
  raioMetros: number;
  de: Date; // meia-noite UTC, inclusivo
  ate: Date; // meia-noite UTC, inclusivo
  tipo: TipoImovelAnalise;
  somenteCompraVenda: boolean;
  areaMin: number | null;
  areaMax: number | null;
}

export interface ResumoAnalise {
  transacoes: number;
  precoM2Mediano: number | null;
  precoM2P25: number | null;
  precoM2P75: number | null;
  valorMediano: number | null;
  areaMediana: number | null;
}

export interface ItemAmostra {
  data: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  areaConstruida: number | null;
  valor: number;
  precoM2: number | null;
  distanciaMetros: number;
  lat: number;
  lng: number;
}

export interface ResultadoCalculo {
  noRaio: number; // todas as linhas do raio/periodo/natureza (principal + planta + outros usos)
  resumo: ResumoAnalise;
  porMes: { mes: string; transacoes: number; precoM2Mediano: number | null }[];
  amostra: ItemAmostra[];
  planta: { transacoes: number; valorMediano: number | null; comMcmv: number };
  financiamento: { mcmv: number; sfh: number; outros: number; semFinanciamento: number };
}

const r2 = (v: number | null) => (v === null ? null : arredondar2(v));

export function calcularAnaliseEndereco(linhas: TransacaoParaAnalise[], p: ParametrosCalculo): ResultadoCalculo {
  const deMs = p.de.getTime();
  const ateMs = p.ate.getTime();

  // 1) raio + periodo + natureza (o repositorio ja filtra, aqui e defesa)
  const noRaio = linhas
    .filter((t) => Number.isFinite(t.latitude) && Number.isFinite(t.longitude))
    .filter((t) => t.dataTransacao.getTime() >= deMs && t.dataTransacao.getTime() <= ateMs)
    .filter((t) => !p.somenteCompraVenda || t.naturezaCodigo === NATUREZA_COMPRA_E_VENDA)
    .map((t) => ({ t, dist: distanciaMetros(p.centro, { lat: t.latitude, lng: t.longitude }) }))
    .filter((x) => x.dist <= p.raioMetros);

  // 2) "na planta" (uso 0, area 0) fica separado, nunca no R$/m2
  const planta = noRaio.filter((x) => ehUnidadeNaPlanta(x.t.usoIptu, x.t.areaConstruida));

  // 3) contagem principal: tipo + faixa de area
  const usos = usosDoTipo(p.tipo);
  const principal = noRaio
    .filter((x) => !ehUnidadeNaPlanta(x.t.usoIptu, x.t.areaConstruida))
    .filter((x) => usos === null || (x.t.usoIptu !== null && usos.includes(x.t.usoIptu)))
    .filter((x) => p.areaMin === null || (x.t.areaConstruida !== null && x.t.areaConstruida >= p.areaMin))
    .filter((x) => p.areaMax === null || (x.t.areaConstruida !== null && x.t.areaConstruida <= p.areaMax));

  // 4) R$/m2: so usos residenciais do tipo, area > 0, faixa plausivel
  const usosM2 = usosPrecoM2(p.tipo);
  const m2Validos = (lista: typeof principal) =>
    lista
      .filter((x) => x.t.usoIptu !== null && usosM2.includes(x.t.usoIptu))
      .map((x) => precoM2(x.t.valorTransacao, x.t.areaConstruida))
      .filter(precoM2Plausivel);

  const precos = m2Validos(principal);
  const resumo: ResumoAnalise = {
    transacoes: principal.length,
    precoM2Mediano: r2(mediana(precos)),
    precoM2P25: r2(percentil(precos, 0.25)),
    precoM2P75: r2(percentil(precos, 0.75)),
    valorMediano: r2(mediana(principal.map((x) => x.t.valorTransacao))),
    areaMediana: r2(
      mediana(principal.map((x) => x.t.areaConstruida).filter((a): a is number => a !== null && a > 0)),
    ),
  };

  const porChave = new Map<string, typeof principal>();
  for (const x of principal) {
    const k = chaveMesUtc(x.t.dataTransacao);
    const l = porChave.get(k) ?? [];
    l.push(x);
    porChave.set(k, l);
  }
  const porMes = mesesDoPeriodoUtc(p.de, p.ate).map((mes) => {
    const l = porChave.get(mes) ?? [];
    return { mes, transacoes: l.length, precoM2Mediano: r2(mediana(m2Validos(l))) };
  });

  const amostra: ItemAmostra[] = [...principal]
    .sort((a, b) => a.dist - b.dist || b.t.dataTransacao.getTime() - a.t.dataTransacao.getTime())
    .slice(0, MAX_AMOSTRA)
    .map((x) => ({
      data: formatarDataUtc(x.t.dataTransacao),
      logradouro: x.t.logradouro,
      numero: x.t.numero,
      bairro: x.t.bairro,
      areaConstruida: x.t.areaConstruida,
      valor: arredondar2(x.t.valorTransacao),
      precoM2: r2(precoM2(x.t.valorTransacao, x.t.areaConstruida)),
      distanciaMetros: Math.round(x.dist),
      lat: x.t.latitude,
      lng: x.t.longitude,
    }));

  const financiamento = { mcmv: 0, sfh: 0, outros: 0, semFinanciamento: 0 };
  for (const x of [...principal, ...planta]) {
    financiamento[categoriaFinanciamento(x.t.tipoFinanciamentoCodigo, x.t.tipoFinanciamento)]++;
  }

  return {
    noRaio: noRaio.length,
    resumo,
    porMes,
    amostra,
    planta: {
      transacoes: planta.length,
      valorMediano: r2(mediana(planta.map((x) => x.t.valorTransacao))),
      comMcmv: planta.filter((x) => categoriaFinanciamento(x.t.tipoFinanciamentoCodigo, x.t.tipoFinanciamento) === 'mcmv')
        .length,
    },
    financiamento,
  };
}
