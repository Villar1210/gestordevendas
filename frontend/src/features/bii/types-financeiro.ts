// Tipos da Viabilidade financeira (BII Fatia 7) - copia do contrato em
// docs/bii/fatia7/CONTRATO_VIABILIDADE_FINANCEIRA.md.

export type RegimeImposto = "ret4" | "ret1" | "outro";
export type SituacaoFinanceira = "viavel" | "apertado" | "inviavel";

export interface PremissasFinanceiras {
  terreno: { valorCompra: number; itbiPercentual: number; escrituraRegistroPercentual: number; permutaPercentual: number };
  obra: { custoM2: number; areaConstruida: number | null; fatorAreaConstruida: number; indiretosPercentual: number; contingenciaPercentual: number };
  comercial: { impostoRegime: RegimeImposto; impostoPercentual: number; comissaoPercentual: number; marketingPercentual: number };
  margemAlvoPercentual: number;
}

export interface PremissasFinanceirasInput {
  terreno?: Partial<PremissasFinanceiras["terreno"]>;
  obra: Partial<PremissasFinanceiras["obra"]> & { custoM2: number };
  comercial?: Partial<PremissasFinanceiras["comercial"]>;
  margemAlvoPercentual?: number;
}

export interface TipologiaFinanceira {
  descricao: string;
  areaPrivativa: number;
  preco: number;
  quantidade: number;
}

export interface ReferenciaCub {
  rotulo: string;
  mesReferencia: string;
  valorM2: number;
  fonte: string;
  observacao: string;
}

export interface ResultadoFinanceiro {
  premissas: PremissasFinanceiras;
  tipologias: (TipologiaFinanceira & { vgv: number; areaPrivativaTotal: number })[];
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
    margemVgvPercentual: number;
    margemCustoPercentual: number | null;
    pesoTerrenoPercentual: number;
    custoM2Privativo: number;
    custoObraM2Privativo: number;
    valorMaximoTerreno: number | null;
    situacao: SituacaoFinanceira;
  };
  referenciaCub: ReferenciaCub & { razaoCustoCub: number };
  avisos: string[];
  observacao: string;
}

export interface ParametrosFinanceiros {
  padroes: {
    terreno: PremissasFinanceiras["terreno"];
    obra: { areaConstruida: number | null; fatorAreaConstruida: number; indiretosPercentual: number; contingenciaPercentual: number };
    comercial: { impostoRegime: RegimeImposto; comissaoPercentual: number; marketingPercentual: number };
    margemAlvoPercentual: number;
  };
  regimesImposto: { valor: RegimeImposto; rotulo: string; percentual: number | null }[];
  cub: ReferenciaCub & { vigenteDesde: string };
  observacao: string;
}
