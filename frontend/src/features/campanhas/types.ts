// src/features/campanhas/types.ts
// Espelho dos tipos devolvidos por /campanhas-sms (backend:
// src/modules/campanhas_sms). Projetos separados: sem codigo compartilhado.

export type StatusCampanha = "rascunho" | "enviando" | "pausada" | "concluida" | "cancelada";
export type StatusContato =
  | "pendente"
  | "enviando"
  | "enviado"
  | "entregue"
  | "falhou"
  | "bloqueado"
  | "optout"
  | "cancelado";

export type Contagens = Record<StatusContato, number> & {
  total: number;
  comClique: number;
  cliquesTotais: number;
  comResposta: number;
};

export interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  linkDestino: string;
  status: StatusCampanha;
  maxSegmentos: number;
  taxaPorMinuto: number;
  janelaInicio: number;
  janelaFim: number;
  codigoTeste: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  createdAt: string;
  updatedAt: string;
  contagens: Contagens;
}

export interface AnaliseTexto {
  codificacao: "GSM7" | "UCS2";
  tamanho: number;
  segmentos: number;
  caracteresForaDoGsm: string[];
}

export interface CampanhaDetalhe extends Campanha {
  linkBase: string;
  linkTeste: string;
  provedor: { nome: string; simulado: boolean; disponivel: boolean };
  mensagemAnalise: (AnaliseTexto & { exemplo: string; cabe: boolean; maiorPrimeiroNome: string }) | null;
}

export interface Contato {
  id: string;
  campanhaId: string;
  nome: string;
  primeiroNome: string;
  telefone: string;
  telefoneFormatado: string;
  corretor: string | null;
  referencia: string | null;
  status: StatusContato;
  codigo: string;
  link: string;
  tentativas: number;
  erro: string | null;
  enviadoEm: string | null;
  entregueEm: string | null;
  cliques: number;
  primeiroCliqueEm: string | null;
  respostaTexto: string | null;
  respondidoEm: string | null;
}

export interface PaginaContatos {
  itens: Contato[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ResultadoImportacao {
  linhasLidas: number;
  importados: number;
  bloqueados: number;
  invalidos: number;
  duplicados: number;
  ignoradosPorLimite: number;
  totalNaCampanha: number;
}

export interface DadosCampanha {
  nome: string;
  mensagem: string;
  linkDestino: string;
  maxSegmentos: number;
  taxaPorMinuto: number;
  janelaInicio: number;
  janelaFim: number;
}

export type FiltroExportacao = "todos" | "clicou" | "respondeu" | "optout" | "falhou";
