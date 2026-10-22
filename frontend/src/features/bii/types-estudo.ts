// Tipos do Estudo de terreno (BII Fatia 5) - copia do contrato em
// docs/bii/fatia5/CONTRATO_ESTUDO.md.
import type { AnaliseEnderecoResponse } from "./types-endereco";
import type { Premissas, ViabilidadeResposta } from "./types-viabilidade";

export type ClassePosicao = "abaixo" | "alinhado" | "acima";

export interface Posicao {
  diferencaPercentual: number;
  classe: ClassePosicao;
}

export interface PosicionamentoTipologia {
  descricao: string;
  precoM2: number;
  concorrentes: Posicao | null;
  itbi: { precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null };
}

export interface AlertaEstudo {
  codigo: "AMOSTRA_PEQUENA" | "SEM_CONCORRENTES" | "ANALISE_SEM_CONCORRENTES" | "ANALISE_ANTIGA";
  mensagem: string;
}

export interface ResumoExecutivo {
  itbi: { transacoes: number; precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null; de: string; ate: string };
  concorrentes: { quantidade: number; precoM2Mediano: number | null } | null;
  viabilidade: { tipologias: number; ok: number; atencao: number; fora: number; enquadramMcmv: number };
  tipologias: { precoM2Medio: number; posicaoMedia: Posicao | null };
}

export interface Estudo {
  id: string;
  nome: string;
  conclusao: string | null;
  analiseId: string | null;
  versao: number;
  analise: AnaliseEnderecoResponse;
  viabilidade: ViabilidadeResposta;
  resumoExecutivo: ResumoExecutivo;
  posicionamento: PosicionamentoTipologia[];
  alertas: AlertaEstudo[];
  destaques: string[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface EstudoListaItem {
  id: string;
  nome: string;
  endereco: string;
  raioMetros: number;
  meses: number;
  situacao: { ok: number; atencao: number; fora: number };
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarEstudoInput {
  analiseId: string;
  nome: string;
  conclusao: string | null;
  tipologias: { descricao: string; areaPrivativa: number; preco: number }[];
  premissas: Partial<Premissas>;
}
