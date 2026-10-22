// Tipos dos Concorrentes (BII Fatia 3) - copia do contrato em
// docs/bii/fatia3/CONTRATO_CONCORRENTES.md (frontend e backend sao projetos
// separados, sem compartilhamento de codigo).

export type FaseConcorrente = "lancamento" | "obras" | "pronto";

export interface TipologiaConcorrente {
  descricao: string;
  dormitorios: number | null;
  areaPrivativa: number;
  precoDe: number;
  precoAte: number | null;
  precoM2De: number | null;
  precoM2Ate: number | null;
}

export interface Concorrente {
  id: string;
  nome: string;
  construtora: string | null;
  endereco: string;
  enderecoFormatado: string | null;
  lat: number;
  lng: number;
  precisao: string; // rooftop|rua|cep|bairro|manual
  fase: FaseConcorrente;
  dataLancamento: string | null; // YYYY-MM-DD
  totalUnidades: number | null;
  unidadesVendidas: number | null;
  fonte: string | null;
  fonteUrl: string | null;
  observacoes: string | null;
  origem: string;
  tipologias: TipologiaConcorrente[];
  calculado: {
    precoM2Mediano: number | null;
    precoM2Min: number | null;
    precoM2Max: number | null;
    precoMin: number | null;
    precoMax: number | null;
    percentualVendido: number | null;
    vendasPorMes: number | null;
    desatualizado: boolean;
  };
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConcorrenteNoRaio extends Concorrente {
  distanciaMetros: number;
}

export interface ConcorrentesDaAnalise {
  itens: ConcorrenteNoRaio[];
  resumo: { quantidade: number; precoM2Mediano: number | null; unidadesTotais: number | null };
}

// Corpo de POST/PATCH /bii/concorrentes.
export interface ConcorrenteInput {
  nome: string;
  construtora: string | null;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  fase: FaseConcorrente;
  dataLancamento: string | null;
  totalUnidades: number | null;
  unidadesVendidas: number | null;
  fonte: string | null;
  fonteUrl: string | null;
  observacoes: string | null;
  tipologias: { descricao: string; dormitorios: number | null; areaPrivativa: number; precoDe: number; precoAte: number | null }[];
}
