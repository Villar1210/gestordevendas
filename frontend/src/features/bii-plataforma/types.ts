// Tipos das rotas /bii-plataforma/itbi/* (so Super Usuario). O contrato
// (docs/bii/fatia2/CONTRATO_ANALISE_ENDERECO.md) lista os campos sem fixar
// os nomes - estes espelham os use cases do backend
// (itbi-plataforma.use-cases.ts / geocodificacao-itbi.service.ts). A tela
// trata qualquer campo ausente como "—" para nao quebrar.

export type StatusImportacao = "processando" | "concluida" | "erro";

export interface ItbiImportacao {
  id: string;
  nomeArquivo: string; // nome sanitizado
  ano: number;
  status: StatusImportacao;
  linhasLidas: number | null;
  linhasInseridas: number | null;
  linhasDuplicadas: number | null;
  linhasDescartadas: number | null;
  mensagemErro: string | null; // sem dado sensivel
  abas?: string[] | null;
  iniciadoEm: string;
  concluidoEm: string | null;
}

// 202 do POST /bii-plataforma/itbi/importar
export interface ImportarItbiResponse {
  importacaoId: string;
}

// Body do POST /bii-plataforma/itbi/geocodificar
export interface GeocodificarInput {
  ceps?: string[]; // prefixos de 5 digitos
  bairros?: string[];
  max?: number; // <= 5000, padrao 2000
}

export type StatusGeocodificacao = "processando" | "concluida" | "erro" | "cancelada";

// Job de geocodificacao (atual ou o ultimo). O 202 do POST
// /bii-plataforma/itbi/geocodificar devolve este objeto; o GET
// /bii-plataforma/itbi/geocodificacao devolve { atual } (null = nunca rodou).
export interface ProgressoGeocodificacao {
  id: string;
  status: StatusGeocodificacao;
  enfileirados: number;
  processados: number;
  encontrados: number;
  naoEncontrados: number;
  falhas?: number;
  transacoesAtualizadas?: number;
  iniciadoEm: string;
  concluidoEm: string | null;
  mensagemErro: string | null;
}

export type GeocodificarResponse = ProgressoGeocodificacao;
