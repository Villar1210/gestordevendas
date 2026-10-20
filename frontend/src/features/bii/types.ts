// src/features/bii/types.ts
// Tipos do GET /bii/painel - copia EXATA do contrato em
// docs/bii/fatia1/CONTRATO_PAINEL.md (frontend e backend sao projetos
// separados, sem compartilhamento de codigo). Valores em reais como number;
// percentuais 0-100 com 1 casa; null quando nao ha base para calcular.

export interface ResumoVendas {
  leadsNovos: number; // cards criados no periodo (filtros aplicados)
  ganhos: number; // cards distintos que ENTRARAM em "Fechamento" no periodo
  perdidos: number; // cards distintos que ENTRARAM em "Repique" no periodo
  conversaoPct: number | null; // ganhos / leadsNovos * 100
  vgvGanho: number; // soma de Card.value dos ganhos (value nulo conta 0)
  ticketMedio: number | null; // vgvGanho / ganhos com value preenchido
  cicloMedioDias: number | null; // media (data do ganho - Card.createdAt) em dias
  cicloMedianoDias: number | null;
}

export interface PainelVendasResponse {
  periodo: { de: string; ate: string }; // YYYY-MM-DD
  historicoDesde: string | null; // ISO do 1o BiiCardStageEvento do tenant (null = ainda nao ha historico)
  pipelineId: string | null;
  pipelines: { id: string; nome: string }[];
  filtros: { corretores: { id: string; nome: string }[]; origens: string[] };
  resumo: ResumoVendas;
  comparativo: ResumoVendas; // periodo anterior de mesma duracao
  funil: { stageId: string; nome: string; entradas: number; conversaoProximaPct: number | null }[];
  vgvPorMes: { mes: string /* YYYY-MM */; vgv: number; ganhos: number }[]; // todos os meses do periodo, inclusive zerados
  ranking: {
    corretorId: string;
    nome: string;
    leads: number;
    ganhos: number;
    conversaoPct: number | null;
    vgv: number;
  }[]; // ordenado por vgv desc, depois ganhos
  porOrigem: { origem: string; leads: number; ganhos: number; conversaoPct: number | null }[];
  motivosPerda: { motivo: string; rotulo: string; quantidade: number; pct: number }[];
}

// Query do GET /bii/painel (todos opcionais).
export interface PainelVendasQuery {
  de?: string; // YYYY-MM-DD
  ate?: string; // YYYY-MM-DD
  pipelineId?: string;
  corretorId?: string;
  origem?: string;
}

// Estado dos filtros na tela (antes de virar query).
export type PeriodoPreset = "3" | "6" | "12" | "personalizado";

export interface PainelFiltrosState {
  preset: PeriodoPreset;
  de: string; // so usado com preset "personalizado"
  ate: string;
  pipelineId: string; // "" = padrao do backend
  corretorId: string; // "" = todos
  origem: string; // "" = todas
}
