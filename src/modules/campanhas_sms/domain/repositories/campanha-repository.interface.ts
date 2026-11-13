// src/modules/campanhas_sms/domain/repositories/campanha-repository.interface.ts
// Persistencia do modulo. POR TENANT: toda leitura/escrita de tela recebe
// tenantId; as operacoes do job/webhook/link publico (que nao tem usuario)
// trabalham por id do contato/campanha ja obtido de forma segura.
import type { StatusCampanha, StatusContato } from '../services/campanha-regras';

export interface CampanhaRecord {
  id: string;
  tenantId: string;
  nome: string;
  mensagem: string;
  linkDestino: string;
  status: StatusCampanha;
  maxSegmentos: number;
  taxaPorMinuto: number;
  janelaInicio: number;
  janelaFim: number;
  codigoTeste: string;
  criadoPorUserId: string;
  iniciadaEm: Date | null;
  concluidaEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NovaCampanha {
  tenantId: string;
  nome: string;
  mensagem: string;
  linkDestino: string;
  maxSegmentos: number;
  taxaPorMinuto: number;
  janelaInicio: number;
  janelaFim: number;
  codigoTeste: string;
  criadoPorUserId: string;
}

export type AlteracaoCampanha = Partial<
  Pick<CampanhaRecord, 'nome' | 'mensagem' | 'linkDestino' | 'maxSegmentos' | 'taxaPorMinuto' | 'janelaInicio' | 'janelaFim'>
>;

export interface ContatoRecord {
  id: string;
  campanhaId: string;
  tenantId: string;
  nome: string;
  primeiroNome: string;
  telefone: string;
  corretor: string | null;
  referencia: string | null;
  status: StatusContato;
  codigo: string;
  tentativas: number;
  provedorMensagemId: string | null;
  erro: string | null;
  enviadoEm: Date | null;
  entregueEm: Date | null;
  cliques: number;
  primeiroCliqueEm: Date | null;
  ultimoCliqueEm: Date | null;
  respostaTexto: string | null;
  respondidoEm: Date | null;
  optoutEm: Date | null;
  createdAt: Date;
}

export interface NovoContato {
  nome: string;
  primeiroNome: string;
  telefone: string;
  corretor: string | null;
  referencia: string | null;
  codigo: string;
  status: Extract<StatusContato, 'pendente' | 'bloqueado'>;
}

export type Contagens = Record<StatusContato, number> & {
  total: number;
  comClique: number;
  cliquesTotais: number;
  comResposta: number;
};

export interface FiltroContatos {
  status?: StatusContato;
  busca?: string;
  // exportacao: so quem clicou / respondeu
  somenteClicou?: boolean;
  somenteRespondeu?: boolean;
}

export interface ContatoParaClique {
  contatoId: string;
  campanhaId: string;
  linkDestino: string;
}

export interface ContatoRecente {
  id: string;
  tenantId: string;
  campanhaId: string;
  enviadoEm: Date;
}

export interface ICampanhaRepository {
  // --- campanha (tela) ---
  criar(d: NovaCampanha): Promise<CampanhaRecord>;
  buscar(tenantId: string, id: string): Promise<CampanhaRecord | null>;
  listar(tenantId: string, limite: number): Promise<CampanhaRecord[]>;
  contarCampanhas(tenantId: string): Promise<number>;
  /** updateMany condicional (tenant + status permitido). false = nao alterou. */
  atualizar(tenantId: string, id: string, dados: AlteracaoCampanha, statusPermitidos: StatusCampanha[]): Promise<boolean>;
  mudarStatus(
    tenantId: string,
    id: string,
    de: StatusCampanha[],
    para: StatusCampanha,
    extra?: { iniciadaEm?: Date; concluidaEm?: Date },
  ): Promise<boolean>;
  contagens(campanhaIds: string[]): Promise<Map<string, Contagens>>;

  // --- contatos (tela) ---
  contarContatos(campanhaId: string): Promise<number>;
  telefonesDaCampanha(campanhaId: string): Promise<Set<string>>;
  /** createMany skipDuplicates. Devolve quantos entraram. */
  inserirContatos(tenantId: string, campanhaId: string, contatos: NovoContato[]): Promise<number>;
  apagarContatos(tenantId: string, campanhaId: string): Promise<number>;
  listarContatos(
    tenantId: string,
    campanhaId: string,
    filtro: FiltroContatos,
    pagina: number,
    porPagina: number,
  ): Promise<{ itens: ContatoRecord[]; total: number }>;
  contatosParaExportar(tenantId: string, campanhaId: string, filtro: FiltroContatos, limite: number): Promise<ContatoRecord[]>;
  /** Maior primeiro nome entre os que ainda vao receber (pendente). */
  maiorPrimeiroNome(campanhaId: string): Promise<string>;
  cancelarPendentes(campanhaId: string): Promise<number>;
  /** Codigos ja usados (contatos OU codigo de teste de campanha). */
  codigosEmUso(codigos: string[]): Promise<Set<string>>;

  // --- opt-out ---
  listarOptouts(tenantId: string, limite: number): Promise<{ telefone: string; origem: string; createdAt: Date }[]>;
  telefonesEmOptout(tenantId: string, telefones: string[]): Promise<Set<string>>;
  registrarOptout(tenantId: string, telefone: string, origem: 'resposta' | 'manual' | 'importacao'): Promise<void>;
  /** Contatos ainda nao enviados daquele numero no tenant -> optout. */
  marcarOptoutPendentes(tenantId: string, telefone: string, quando: Date): Promise<number>;

  // --- envio (job) ---
  campanhasEnviando(): Promise<CampanhaRecord[]>;
  pendentes(campanhaId: string, limite: number): Promise<ContatoRecord[]>;
  /** pendente -> enviando (tentativas + 1). false = outro processo pegou. */
  reservar(contatoId: string): Promise<boolean>;
  marcarEnviado(contatoId: string, provedorMensagemId: string, quando: Date): Promise<void>;
  devolverPendente(contatoId: string, erro: string): Promise<void>;
  marcarFalhou(contatoId: string, erro: string): Promise<void>;
  marcarBloqueado(contatoId: string): Promise<void>;
  existeAEnviar(campanhaId: string): Promise<boolean>;
  /** Contatos presos em "enviando" -> falhou (nunca reenvia sozinho). */
  falharTravados(erro: string): Promise<number>;

  // --- link curto (publico) ---
  contatoPorCodigo(codigo: string): Promise<ContatoParaClique | null>;
  campanhaPorCodigoTeste(codigo: string): Promise<{ id: string; linkDestino: string } | null>;
  registrarClique(contatoId: string, quando: Date): Promise<void>;

  // --- webhook ---
  atualizarEntrega(provedorMensagemId: string, status: 'entregue' | 'falhou' | 'enviado', quando: Date, erro?: string): Promise<number>;
  contatosRecentesDoTelefone(telefone: string, desde: Date): Promise<ContatoRecente[]>;
  registrarResposta(contatoId: string, texto: string, quando: Date, optout: boolean): Promise<void>;
}

export const CAMPANHA_REPOSITORY = Symbol('ICampanhaRepository');
