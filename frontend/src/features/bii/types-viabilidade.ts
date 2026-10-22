// Tipos da Viabilidade HIS/HMP/MCMV (BII Fatia 4) - copia do contrato em
// docs/bii/fatia4/CONTRATO_VIABILIDADE.md.

export type Situacao = "ok" | "atencao" | "fora";

export interface Premissas {
  entradaPercentual: number;
  prazoMeses: number;
  comprometimentoPercentual: number;
  jurosAnual: number | null;
}

export interface ResultadoTipologia {
  descricao: string;
  areaPrivativa: number;
  preco: number;
  precoM2: number;
  municipal: {
    categoria: "HIS1" | "HIS2" | "HMP" | "MERCADO";
    rotulo: string;
    teto: number | null;
    folga: number | null;
    folgaPercentual: number | null;
    rendaMax: number | null;
    rendaDentro: boolean | null;
  };
  mcmv: {
    faixaPeloPreco: string | null;
    faixaPelaRenda: string | null;
    rotuloFaixaPelaRenda: string;
    tetoFaixaPelaRenda: number | null;
    enquadra: boolean;
    rendaPeloPiso: boolean;
  };
  financiamento: { valorFinanciado: number; entrada: number; jurosAnual: number; parcela: number; rendaNecessaria: number };
  situacao: Situacao;
  avisos: string[];
}

export interface ParametrosVigentes {
  dataReferencia: string;
  municipal: {
    vigenteDesde: string;
    fonte: string;
    salarioMinimoRef: number;
    categorias: { categoria: string; rotulo: string; rendaMax: number; salariosMinimos: number; tetoVenda: number }[];
  };
  mcmv: {
    vigenteDesde: string;
    fonte: string;
    observacao: string;
    faixas: { faixa: string; rotulo: string; rendaMin: number; rendaMax: number; tetoImovel: number; jurosReferenciaAnual: number }[];
    jurosForaAnual: number;
  };
}

export interface ViabilidadeResposta {
  premissas: Premissas;
  resultados: ResultadoTipologia[];
  parametros: ParametrosVigentes;
  observacao: string;
}

export interface ViabilidadeInput {
  tipologias: { descricao: string; areaPrivativa: number; preco: number }[];
  premissas: Partial<Premissas>;
}
