// src/modules/bii/domain/repositories/itbi-importacao-repository.interface.ts
// ItbiImportacao (GLOBAL): historico/status de cada importacao do ITBI.

export type StatusImportacao = 'processando' | 'concluida' | 'erro';

export interface AbaImportacao {
  nome: string;
  status: 'importada' | 'ignorada';
  motivo?: string;
  linhas: number;
}

export interface ItbiImportacaoRegistro {
  id: string;
  nomeArquivo: string;
  ano: number;
  status: StatusImportacao;
  linhasLidas: number;
  linhasInseridas: number;
  linhasDuplicadas: number;
  linhasDescartadas: number;
  abas: AbaImportacao[];
  mensagemErro: string | null;
  importadoPorUserId: string;
  iniciadoEm: Date;
  atualizadoEm: Date;
  concluidoEm: Date | null;
}

export interface ProgressoImportacao {
  linhasLidas: number;
  linhasInseridas: number;
  linhasDuplicadas: number;
  linhasDescartadas: number;
  abas: AbaImportacao[];
}

export interface IItbiImportacaoRepository {
  criar(dados: { nomeArquivo: string; ano: number; importadoPorUserId: string }): Promise<ItbiImportacaoRegistro>;
  // as que estao "processando" (para a regra de uma por vez)
  listarProcessando(): Promise<ItbiImportacaoRegistro[]>;
  atualizarProgresso(id: string, p: ProgressoImportacao): Promise<void>;
  finalizar(id: string, status: 'concluida' | 'erro', p: ProgressoImportacao, mensagemErro: string | null): Promise<void>;
  // "processando" sem atualizacao ha muito tempo (processo caiu) -> erro
  marcarAbandonada(id: string, mensagem: string): Promise<void>;
  // no inicio do processo: todas as "processando" -> erro (devolve quantas)
  marcarTodasProcessandoComoErro(mensagem: string): Promise<number>;
  listar(limite: number): Promise<ItbiImportacaoRegistro[]>;
  anosConcluidos(): Promise<number[]>;
  ultimaConcluida(): Promise<Date | null>;
}

export const ITBI_IMPORTACAO_REPOSITORY = 'IItbiImportacaoRepository';
