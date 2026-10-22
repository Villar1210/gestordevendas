// src/modules/bii/domain/services/parametros-habitacionais.ts
// Fatia 4 - parametros oficiais HIS/HMP (Prefeitura de SP) e MCMV (federal),
// VERSIONADOS NO CODIGO: cada versao tem vigenteDesde e fonte. Mudou a regra ->
// acrescentar uma versao nova (o historico fica no git), nunca editar uma
// antiga. Funcoes PURAS. Contrato: docs/bii/fatia4/CONTRATO_VIABILIDADE.md

export type CategoriaMunicipal = 'HIS1' | 'HIS2' | 'HMP';
export type FaixaMcmv = 'F1' | 'F2' | 'F3' | 'F4';

export interface ParametroMunicipal {
  categoria: CategoriaMunicipal;
  rotulo: string;
  rendaMax: number;
  salariosMinimos: number;
  tetoVenda: number;
}

export interface ParametroMcmv {
  faixa: FaixaMcmv;
  rotulo: string;
  rendaMin: number;
  rendaMax: number;
  tetoImovel: number;
  jurosReferenciaAnual: number; // %, maior da faixa (nao cotista) - estimativa conservadora
}

export interface VersaoMunicipal {
  vigenteDesde: string; // YYYY-MM-DD
  fonte: string;
  salarioMinimoRef: number;
  categorias: ParametroMunicipal[]; // em ordem crescente de teto
}

export interface VersaoMcmv {
  vigenteDesde: string;
  fonte: string;
  observacao: string;
  faixas: ParametroMcmv[]; // em ordem crescente de renda
  jurosForaAnual: number; // SBPE (acima da Faixa 4), referencia
}

export const VERSOES_MUNICIPAIS: VersaoMunicipal[] = [
  {
    vigenteDesde: '2026-01-06',
    fonte: 'Prefeitura de São Paulo — Decreto 64.895 de 05/01/2026 (DOM 06/01/2026)',
    salarioMinimoRef: 1621,
    categorias: [
      { categoria: 'HIS1', rotulo: 'HIS-1', rendaMax: 4863, salariosMinimos: 3, tetoVenda: 276102.2 },
      { categoria: 'HIS2', rotulo: 'HIS-2', rendaMax: 9726, salariosMinimos: 6, tetoVenda: 383636.74 },
      { categoria: 'HMP', rotulo: 'HMP', rendaMax: 16210, salariosMinimos: 10, tetoVenda: 537672.71 },
    ],
  },
];

export const VERSOES_MCMV: VersaoMcmv[] = [
  {
    vigenteDesde: '2026-04-22',
    fonte: 'Minha Casa, Minha Vida — Conselho Curador do FGTS (24/03/2026), operado pela Caixa desde 22/04/2026',
    observacao:
      'Tetos da cidade de São Paulo (Faixas 1 e 2 variam por região; a capital usa o maior). Juros de referência: maior taxa da faixa, sem desconto de cotista do FGTS.',
    faixas: [
      { faixa: 'F1', rotulo: 'Faixa 1', rendaMin: 0, rendaMax: 3200, tetoImovel: 275000, jurosReferenciaAnual: 5.25 },
      { faixa: 'F2', rotulo: 'Faixa 2', rendaMin: 3200.01, rendaMax: 5000, tetoImovel: 275000, jurosReferenciaAnual: 7 },
      { faixa: 'F3', rotulo: 'Faixa 3', rendaMin: 5000.01, rendaMax: 9600, tetoImovel: 400000, jurosReferenciaAnual: 8.16 },
      { faixa: 'F4', rotulo: 'Faixa 4', rendaMin: 9600.01, rendaMax: 13000, tetoImovel: 600000, jurosReferenciaAnual: 10.5 },
    ],
    jurosForaAnual: 12,
  },
];

// Versao vigente na data (YYYY-MM-DD, comparacao de texto ISO); antes da
// primeira versao, vale a primeira (nao ha dado anterior no sistema).
export function versaoVigente<T extends { vigenteDesde: string }>(versoes: T[], data: string): T {
  const ordenadas = [...versoes].sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
  let atual = ordenadas[0];
  for (const v of ordenadas) if (v.vigenteDesde <= data) atual = v;
  return atual;
}
