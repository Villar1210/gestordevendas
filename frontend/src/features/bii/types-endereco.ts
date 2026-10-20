// Tipos da Analise por Endereco (BII Fatia 2) - copia do contrato em
// docs/bii/fatia2/CONTRATO_ANALISE_ENDERECO.md (frontend e backend sao
// projetos separados, sem compartilhamento de codigo).

// Filtro de uso do IPTU (ver docs/bii/fatia2/ITBI_COLUNAS.md).
export type TipoImovelItbi = "residencial" | "apartamento" | "casa" | "todos";

export type PrecisaoGeocodificacao = "rooftop" | "rua" | "cep" | "bairro";

export interface TransacaoAmostra {
  data: string; // YYYY-MM-DD
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

export interface AnaliseEnderecoResponse {
  id: string;
  endereco: { digitado: string; formatado: string; lat: number; lng: number; precisao: PrecisaoGeocodificacao };
  parametros: {
    raioMetros: number;
    meses: number;
    areaMin: number | null;
    areaMax: number | null;
    de: string;
    ate: string;
    // Eco dos filtros novos; opcional para analises salvas antes deles.
    tipo?: TipoImovelItbi;
    somenteCompraVenda?: boolean;
  };
  // semLocalizacao = ITBI da regiao ainda nao geocodificado (aviso)
  cobertura: { transacoesNoPeriodoNaRegiao: number; semLocalizacao: number };
  resumo: {
    transacoes: number;
    precoM2Mediano: number | null;
    precoM2P25: number | null;
    precoM2P75: number | null;
    valorMediano: number | null;
    areaMediana: number | null;
  };
  // Vendas sem area construida no IPTU (Uso 0 TERRENO): em geral unidades
  // novas na planta, cujo SQL ainda e o do terreno - mercado HIS/MCMV. Sem
  // R$/m2; ficam fora do resumo de preco por m2.
  planta: { transacoes: number; valorMediano: number | null; comMcmv: number };
  financiamento: { mcmv: number; sfh: number; outros: number; semFinanciamento: number };
  porMes: { mes: string /* YYYY-MM */; transacoes: number; precoM2Mediano: number | null }[];
  amostra: TransacaoAmostra[]; // ate 200, mais proximas primeiro
  fonte: { nome: string; atualizadoAte: string | null; observacao: string };
  criadoEm: string;
}

export type RaioMetros = 500 | 1000 | 2000;
export type PeriodoMeses = 6 | 12 | 24 | 36;

// Body do POST /bii/analises/endereco.
export interface AnaliseEnderecoInput {
  endereco: string;
  raioMetros: RaioMetros;
  meses: PeriodoMeses;
  tipo: TipoImovelItbi;
  somenteCompraVenda: boolean;
  areaMin?: number;
  areaMax?: number;
}

// Item do GET /bii/analises (ultimas 50 do tenant) - espelha
// AnaliseListaItem do backend (analises-salvas.use-case.ts).
export interface AnaliseResumoItem {
  id: string;
  endereco: string; // digitado
  enderecoFormatado: string;
  raioMetros: number;
  meses: number;
  criadoEm: string;
  transacoes: number;
  precoM2Mediano: number | null;
}

// GET /bii/itbi/cobertura
export interface CoberturaItbi {
  anos: number[];
  totalTransacoes: number;
  geocodificadas: number;
  ultimaImportacao: string | null;
}
