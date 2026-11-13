// src/modules/campanhas_sms/domain/services/leitor-planilha.interface.ts
// Leitura do arquivo importado (.xlsx ou .csv) como linhas de texto. A infra
// decide o formato pelos BYTES (nao pela extensao) e aplica os limites.

export interface ILeitorPlanilhaContatos {
  /** Linhas (a primeira e o cabecalho). Lanca ArquivoInvalidoError. */
  ler(arquivo: Buffer, nomeArquivo: string, maxLinhas: number): Promise<unknown[][]>;
}

export const LEITOR_PLANILHA = Symbol('ILeitorPlanilhaContatos');

/** Mensagem pronta para o usuario (400). */
export class ArquivoInvalidoError extends Error {}
