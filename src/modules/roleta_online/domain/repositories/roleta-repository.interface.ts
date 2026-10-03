// src/modules/roleta_online/domain/repositories/roleta-repository.interface.ts
// Fatia 2 (Sorteio da vez). Camada de DOMINIO: contrato sem Prisma.

export type TipoRoleta = 'stand' | 'produto';
export type ModoSorteio = 'automatico' | 'botao';
export type OrigemSorteio = 'automatico' | 'botao' | 'seguranca';

export interface RoletaRecord {
  id: string;
  tenantId: string;
  nome: string;
  tipo: TipoRoleta;
  standId: string | null;
  padrao: boolean;
  ativa: boolean;
  modoSorteio: ModoSorteio;
  horariosSorteio: string[];
  minutosSorteioSeguranca: number;
  filaDia: string | null;
  empreendimentoIds: string[];
  corretorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoletaDados {
  nome: string;
  tipo: TipoRoleta;
  standId: string | null;
  padrao: boolean;
  ativa: boolean;
  modoSorteio: ModoSorteio;
  horariosSorteio: string[];
  minutosSorteioSeguranca: number;
}

export interface ParticipanteRecord {
  userId: string;
  nome: string;
  statusDisponibilidade: string;
}

export interface PosicaoRecord {
  userId: string;
  posicao: number;
  entrouEm: Date;
  ultimoLeadEm: Date | null;
}

export interface SorteioRecord {
  id: string;
  roletaId: string;
  origem: OrigemSorteio;
  disparadoPorId: string | null;
  disparadoPorNome: string | null;
  horario: string | null;
  ordem: Array<{ userId: string; nome: string }>;
  createdAt: Date;
}

export interface ExecucaoRecord {
  avisadoEm: Date | null;
  sorteadoEm: Date | null;
}

export interface IRoletaRepository {
  listByTenant(tenantId: string): Promise<RoletaRecord[]>;
  // Para o job de horarios: todas as roletas ativas com horario, de todos os tenants.
  listAtivasComHorario(): Promise<RoletaRecord[]>;
  findById(id: string, tenantId: string): Promise<RoletaRecord | null>;
  create(tenantId: string, dados: RoletaDados): Promise<RoletaRecord>;
  update(id: string, tenantId: string, dados: RoletaDados): Promise<RoletaRecord>;
  delete(id: string, tenantId: string): Promise<void>;
  // Garante no maximo 1 roleta padrao por tenant.
  limparPadrao(tenantId: string, excetoId: string): Promise<void>;
  setEmpreendimentos(roletaId: string, empreendimentoIds: string[]): Promise<void>;
  setCorretores(roletaId: string, userIds: string[]): Promise<void>;

  // Roteamento do lead
  findAtivaPorEmpreendimento(tenantId: string, empreendimentoId: string): Promise<RoletaRecord | null>;
  findPadrao(tenantId: string): Promise<RoletaRecord | null>;
  // Empreendimento do card; sem ele, o do imovel do card (se houver).
  findEmpreendimentoDoCard(cardId: string): Promise<string | null>;

  // Fila
  // Stand: escalados no dia da semana; produto: corretores vinculados.
  listParticipantes(roleta: RoletaRecord, diaSemana: number): Promise<ParticipanteRecord[]>;
  listPosicoes(roletaId: string): Promise<PosicaoRecord[]>;
  // Zera a fila e grava a nova ordem (posicao 1..n) para o dia informado.
  reiniciarFila(roletaId: string, dia: string, ordemUserIds: string[]): Promise<void>;
  // Coloca no fim da fila quem ainda nao esta nela (na ordem recebida).
  adicionarAoFim(roletaId: string, userIds: string[]): Promise<void>;
  // Quem recebeu um lead vai para o fim da fila.
  moverParaFim(roletaId: string, userId: string, quando: Date): Promise<void>;

  // Historico e controle dos horarios
  registrarSorteio(input: {
    roletaId: string;
    origem: OrigemSorteio;
    disparadoPorId: string | null;
    horario: string | null;
    ordem: Array<{ userId: string; nome: string }>;
  }): Promise<SorteioRecord>;
  listSorteios(roletaId: string, limite: number): Promise<SorteioRecord[]>;
  findExecucao(roletaId: string, dia: string, horario: string): Promise<ExecucaoRecord | null>;
  marcarAvisado(roletaId: string, dia: string, horario: string, quando: Date): Promise<void>;
  marcarSorteado(roletaId: string, dia: string, horario: string, quando: Date): Promise<void>;

  // Quem recebe o aviso "hora do sorteio" no modo botao: Administradores,
  // gerentes/diretores e o coordenador do stand da roleta.
  listSupervisores(tenantId: string, standId: string | null): Promise<string[]>;

  // Validacao de vinculos (sempre dentro do tenant)
  existeStand(tenantId: string, standId: string): Promise<boolean>;
  filtrarEmpreendimentosDoTenant(tenantId: string, ids: string[]): Promise<string[]>;
  filtrarUsuariosDoTenant(tenantId: string, ids: string[]): Promise<string[]>;
  nomesUsuarios(ids: string[]): Promise<Map<string, string>>;
}
