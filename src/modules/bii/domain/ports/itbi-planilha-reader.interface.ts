// src/modules/bii/domain/ports/itbi-planilha-reader.interface.ts
// Leitura em STREAMING da planilha do ITBI (infra: exceljs WorkbookReader).
// Entrega as linhas aba por aba, com celulas ja convertidas para valores
// simples (formula -> resultado guardado, nunca avaliada).
import { ValorCelula } from '../services/itbi-valores';

export type EventoPlanilha = { tipo: 'aba'; nome: string } | { tipo: 'linha'; valores: ValorCelula[] };

export interface LimitesLeitura {
  maxLinhas: number; // total do arquivo
  maxBytes: number; // soma aproximada do tamanho dos valores lidos
}

export interface IItbiPlanilhaReader {
  ler(caminho: string, limites: LimitesLeitura, signal?: AbortSignal): AsyncIterable<EventoPlanilha>;
}

// Estouro de limite (anti-"bomba"): mensagem clara, sem dado do arquivo.
export class PlanilhaLimiteExcedidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'PlanilhaLimiteExcedidoError';
  }
}

export const ITBI_PLANILHA_READER = 'IItbiPlanilhaReader';
