// src/modules/vendas_kanban/domain/repositories/card-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface CardRecord {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  // Sugestao pendente da Roleta Online (modo semi_automatico) - ver
  // modulo roleta_online. suggestedOwnerName so vem preenchido pela
  // consulta que a Caixa de Entrada usa (findAllByPipelineInbox).
  suggestedOwnerId: string | null;
  suggestedOwnerName: string | null;
  // Timeout de aceite da Roleta Online (modo automatico) - ver modulo
  // roleta_online, ProcessRoletaTimeoutsUseCase.
  atribuidoAutomaticamenteEm: Date | null;
  aceitoEm: Date | null;
  // Motivo/data de entrada na stage "Repique" - ver
  // domain/services/motivo-repique.ts e MoverLeadsInativosParaRepiqueUseCase.
  motivoRepique: string | null;
  movidoParaRepiqueEm: Date | null;
  // So preenchidos pela consulta do Portal do Cliente (findAllByTenantAndEmail).
  stageName: string | null;
  ownerName: string | null;
  imovelId: string | null;
  title: string;
  value: number;
  position: number;
  origem: string;
  phone: string | null;
  temperatura: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  // Resumo automatico legivel pelo corretor sem abrir outra tela - hoje so
  // preenchido pela VIVI (ver vivi_sdr/domain/services/build-resumo-atendimento.ts).
  description: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICardRepository {
  create(input: {
    tenantId: string;
    pipelineId: string;
    stageId?: string | null;
    ownerId?: string | null;
    imovelId?: string | null;
    title: string;
    value?: number;
    position: number;
    origem?: string;
    phone?: string | null;
    temperatura?: string | null;
    description?: string | null;
    customFields?: Record<string, unknown>;
    // Preenchidos quando o card ja nasce na stage "Repique" (ver
    // CreateQuickCardUseCase, usado pela VIVI para leads SEM_PERFIL) -
    // mesmo padrao de motivo+data ja usado por MoveCardUseCase e
    // MoverLeadsInativosParaRepiqueUseCase.
    motivoRepique?: string | null;
    movidoParaRepiqueEm?: Date | null;
  }): Promise<CardRecord>;
  findById(id: string): Promise<CardRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<CardRecord | null>;
  // Retorna ordenado por position (crescente).
  findAllByStage(stageId: string): Promise<CardRecord[]>;
  // Cards de um pipeline ainda sem stageId (Caixa de Entrada), mais antigos primeiro.
  findAllByPipelineInbox(pipelineId: string): Promise<CardRecord[]>;
  // Usado pelo Portal do Cliente (GetMeuAtendimentoUseCase) para vincular o
  // usuario logado (por e-mail) aos cards onde ele e o lead/cliente - ver
  // CLAUDE.md sobre a limitacao dessa correspondencia (por valor, nao por
  // FK formal). Inclui stageName/ownerName via join.
  findAllByTenantAndEmail(tenantId: string, email: string): Promise<CardRecord[]>;
  // extra e preenchido so quando o card entra na stage "Repique" (motivo +
  // data de entrada) - ver MoveCardUseCase e MoverLeadsInativosParaRepiqueUseCase.
  updateStageAndPosition(
    id: string,
    stageId: string,
    position: number,
    extra?: { motivoRepique?: string; movidoParaRepiqueEm?: Date },
  ): Promise<void>;
  // Usado exclusivamente pelo fluxo de "assumir lead": atribui dono e
  // move da Caixa de Entrada para uma stage, em uma unica operacao.
  assignOwnerAndStage(
    id: string,
    input: { ownerId: string; stageId: string; position: number },
  ): Promise<CardRecord>;
  // Usado pelo Dashboard do Corretor (GetMeuDashboardUseCase): quantos
  // cards do dono existem em cada stage (cards na Caixa de Entrada, sem
  // stageId, ficam de fora - nao "pertencem" a nenhuma coluna).
  countByOwnerGroupedByStage(
    tenantId: string,
    ownerId: string,
  ): Promise<Array<{ stageId: string; stageName: string; position: number; count: number }>>;
  // Usado pelo Dashboard do Corretor: os N cards mais recentes do dono,
  // mais novos primeiro. Inclui stageName via join (mesmo padrao ja usado
  // por findAllByTenantAndEmail).
  findRecentByOwner(tenantId: string, ownerId: string, limit: number): Promise<CardRecord[]>;
  // Usado pela Roleta Online: define/limpa a sugestao de dono (modo
  // semi_automatico) sem alterar ownerId/stageId.
  updateSuggestedOwner(id: string, suggestedOwnerId: string | null): Promise<CardRecord>;
  // Usado pelo algoritmo "menor_fila": quantos cards ativos (com stage,
  // fora das stages informadas) este dono tem no momento.
  countActiveByOwnerInStages(input: {
    tenantId: string;
    ownerId: string;
    stageIds: string[];
  }): Promise<number>;
  // Timeout de aceite da Roleta Online (modo automatico) - ver modulo
  // roleta_online. Chamado logo apos o ClaimCardUseCase, no momento da
  // atribuicao automatica: inicia a janela de aceite (limpa aceitoEm).
  markAtribuidoAutomaticamente(id: string, when: Date): Promise<void>;
  // Corretor clica em "Aceitar Lead" - so grava aceitoEm, nao mexe em
  // ownerId/stageId (ja atribuidos desde a distribuicao automatica).
  aceitarLead(id: string, when: Date): Promise<CardRecord>;
  // Reatribui o dono apos o timeout de aceite vencer, reiniciando a janela
  // de aceite para o novo corretor (mesmo efeito de markAtribuidoAutomaticamente,
  // + troca de ownerId, numa unica operacao).
  reassignOwnerAfterTimeout(id: string, newOwnerId: string, when: Date): Promise<CardRecord>;
  // Nao havia mais ninguem online para reatribuir - para de rastrear o
  // timeout deste card (fica com o dono atual, sem nova tentativa).
  clearAtribuidoAutomaticamente(id: string): Promise<void>;
  // Usado pelo job de timeout (ProcessRoletaTimeoutsUseCase) - consulta
  // CROSS-TENANT deliberada (job de sistema, nao uma requisicao de um
  // tenant especifico - mesma excecao documentada em ListTenantsUseCase do
  // modulo super_usuario): todo card com atribuicao automatica pendente de
  // aceite, de qualquer tenant.
  findPendentesDeAceite(): Promise<CardRecord[]>;
  // Usado pelo job diario de inatividade (MoverLeadsInativosParaRepiqueUseCase)
  // - consulta CROSS-TENANT deliberada (job de sistema, mesmo padrao de
  // findPendentesDeAceite acima): cards com updatedAt anterior a
  // "antesDe" e que NAO estao em Fechamento nem ja em Repique (Caixa de
  // Entrada, stageId nulo, tambem e elegivel).
  findElegiveisParaRepiqueJob(antesDe: Date): Promise<CardRecord[]>;
  update(
    id: string,
    input: {
      title?: string;
      value?: number;
      phone?: string | null;
      temperatura?: string | null;
      email?: string | null;
      endereco?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      imovelId?: string | null;
      customFields?: Record<string, unknown>;
    },
  ): Promise<CardRecord>;
  delete(id: string): Promise<void>;
  // Usado pela VIVI (ProcessIncomingMessageUseCase) para verificar se um
  // lead que enviou mensagem ja tem corretor responsavel no Kanban -
  // se sim, a VIVI nao responde (o corretor esta cuidando do lead).
  existsByTenantAndPhoneWithOwner(tenantId: string, phone: string): Promise<boolean>;
}
