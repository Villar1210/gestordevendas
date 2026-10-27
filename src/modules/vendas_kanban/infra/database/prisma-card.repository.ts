// src/modules/vendas_kanban/infra/database/prisma-card.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import {
  ICardRepository,
  CardRecord,
} from '../../domain/repositories/card-repository.interface';
import { FECHAMENTO_STAGE_NAME, PROTECTED_STAGE_NAMES, REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

type PrismaCardRow = {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  ownerId: string | null;
  suggestedOwnerId: string | null;
  atribuidoAutomaticamenteEm: Date | null;
  aceitoEm: Date | null;
  motivoRepique: string | null;
  movidoParaRepiqueEm: Date | null;
  repiqueOptOut: boolean;
  repiqueOptOutToken: string | null;
  imovelId: string | null;
  title: string;
  value: { toNumber(): number };
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
  description: string | null;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
  escalonamentoNotificadoEm: Date | null;
  emAtendimentoVivi?: boolean;
  ultimaInteracaoViviEm?: Date | null;
  caixaEntradaDesde?: Date | null;
};

@Injectable()
export class PrismaCardRepository implements ICardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaCardRow): CardRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      pipelineId: row.pipelineId,
      stageId: row.stageId,
      ownerId: row.ownerId,
      // So preenchido pela consulta da Caixa de Entrada (findAllByPipelineInbox),
      // que faz o join com o nome do corretor sugerido.
      suggestedOwnerId: row.suggestedOwnerId,
      suggestedOwnerName: null,
      atribuidoAutomaticamenteEm: row.atribuidoAutomaticamenteEm,
      aceitoEm: row.aceitoEm,
      motivoRepique: row.motivoRepique,
      movidoParaRepiqueEm: row.movidoParaRepiqueEm,
      repiqueOptOut: row.repiqueOptOut,
      repiqueOptOutToken: row.repiqueOptOutToken,
      stageName: null,
      ownerName: null,
      imovelId: row.imovelId,
      title: row.title,
      value: row.value.toNumber(),
      position: row.position,
      origem: row.origem,
      phone: row.phone,
      temperatura: row.temperatura,
      email: row.email,
      endereco: row.endereco,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cep: row.cep,
      description: row.description,
      customFields: (row.customFields as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      escalonamentoNotificadoEm: row.escalonamentoNotificadoEm,
      emAtendimentoVivi: row.emAtendimentoVivi ?? false,
      ultimaInteracaoViviEm: row.ultimaInteracaoViviEm ?? null,
      caixaEntradaDesde: row.caixaEntradaDesde ?? null,
      // Preenchida so pelo use case (GetBoardUseCase/GetInboxUseCase), apos
      // uma consulta em lote a IActivityRepository - ver CardRecord.
      proximaAtividade: null,
    };
  }

  async create(input: {
    tenantId: string;
    pipelineId: string;
    stageId?: string | null;
    ownerId?: string | null;
    imovelId?: string | null;
    empreendimentoId?: string | null;
    title: string;
    value?: number;
    position: number;
    origem?: string;
    phone?: string | null;
    temperatura?: string | null;
    description?: string | null;
    customFields?: Record<string, unknown>;
    motivoRepique?: string | null;
    movidoParaRepiqueEm?: Date | null;
    emAtendimentoVivi?: boolean;
    ultimaInteracaoViviEm?: Date | null;
  }): Promise<CardRecord> {
    try {
      const row = await this.prisma.card.create({
        data: {
          tenantId: input.tenantId,
          pipelineId: input.pipelineId,
          stageId: input.stageId ?? null,
          ownerId: input.ownerId ?? null,
          imovelId: input.imovelId ?? null,
          empreendimentoId: input.empreendimentoId ?? null,
          title: input.title,
          value: input.value ?? 0,
          position: input.position,
          origem: input.origem ?? 'manual',
          phone: input.phone ?? null,
          temperatura: input.temperatura ?? null,
          description: input.description ?? null,
          customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
          motivoRepique: input.motivoRepique ?? null,
          movidoParaRepiqueEm: input.movidoParaRepiqueEm ?? null,
          emAtendimentoVivi: input.emAtendimentoVivi ?? false,
          ultimaInteracaoViviEm: input.ultimaInteracaoViviEm ?? null,
          caixaEntradaDesde: !input.stageId && !input.emAtendimentoVivi ? new Date() : null,
        },
      });
      return this.toRecord(row);
    } catch (error) {
      // Indice unico parcial "cards_captura_auto_vivi_tenant_phone_key"
      // (ver schema.prisma) - so pode disparar quando origem="captura_auto_vivi"
      // (ver CapturarLeadMinimoUseCase); Cards de outras origens nunca violam
      // esse indice, ja que o WHERE do indice nao os cobre.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UniqueConstraintViolationError(
          'Ja existe um Card de captura automatica para este tenant+telefone.',
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByStage(stageId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { stageId },
      orderBy: { position: 'asc' },
      include: { owner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      ownerName: row.owner?.name ?? null,
    }));
  }

  async findAllByPipelineInbox(pipelineId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { pipelineId, stageId: null, emAtendimentoVivi: false },
      orderBy: { createdAt: 'asc' },
      include: { suggestedOwner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      suggestedOwnerName: row.suggestedOwner?.name ?? null,
    }));
  }

  async findAllInboxByTenant(tenantId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { tenantId, stageId: null, ownerId: null, emAtendimentoVivi: false },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findAllByTenantAndEmail(tenantId: string, email: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { tenantId, email },
      orderBy: { createdAt: 'desc' },
      include: { stage: { select: { name: true } }, owner: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      stageName: row.stage?.name ?? null,
      ownerName: row.owner?.name ?? null,
    }));
  }

  async countByOwnerGroupedByStage(
    tenantId: string,
    ownerId: string,
  ): Promise<Array<{ stageId: string; stageName: string; position: number; count: number }>> {
    const groups = await this.prisma.card.groupBy({
      by: ['stageId'],
      // Escopo de metrica pessoal de vendas, nao RBAC - leads brutos do
      // funil de remarketing (ver domain/services/remarketing-pipeline.ts)
      // nunca contam para o Dashboard do Corretor, mesmo se algum dia
      // tiverem ownerId preenchido, nem mesmo para um Administrador.
      where: {
        tenantId,
        ownerId,
        stageId: { not: null },
        pipeline: { name: { not: REMARKETING_PIPELINE_NOME } },
      },
      _count: { _all: true },
    });
    if (groups.length === 0) return [];

    const stageIds = groups.map((g) => g.stageId as string);
    const stages = await this.prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, position: true },
    });
    const stageById = new Map(stages.map((s) => [s.id, s]));

    return groups
      .map((g) => {
        const stage = stageById.get(g.stageId as string);
        return {
          stageId: g.stageId as string,
          stageName: stage?.name ?? 'Etapa removida',
          position: stage?.position ?? 0,
          count: g._count._all,
        };
      })
      .sort((a, b) => a.position - b.position);
  }

  async findRecentByOwner(tenantId: string, ownerId: string, limit: number): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      // Mesmo escopo estrutural de countByOwnerGroupedByStage acima - leads
      // do funil de remarketing nunca aparecem no Dashboard do Corretor.
      where: {
        tenantId,
        ownerId,
        pipeline: { name: { not: REMARKETING_PIPELINE_NOME } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { stage: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...this.toRecord(row),
      stageName: row.stage?.name ?? null,
    }));
  }

  async updateSuggestedOwner(id: string, suggestedOwnerId: string | null): Promise<CardRecord> {
    const row = await this.prisma.card.update({ where: { id }, data: { suggestedOwnerId } });
    return this.toRecord(row);
  }

  async countActiveByOwnerInStages(input: {
    tenantId: string;
    ownerId: string;
    stageIds: string[];
  }): Promise<number> {
    return this.prisma.card.count({
      where: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        stageId: { in: input.stageIds },
      },
    });
  }

  async updateStageAndPosition(
    id: string,
    stageId: string,
    position: number,
    extra?: { motivoRepique?: string; movidoParaRepiqueEm?: Date },
  ): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: {
        stageId,
        position,
        ...(extra?.motivoRepique !== undefined ? { motivoRepique: extra.motivoRepique } : {}),
        ...(extra?.movidoParaRepiqueEm !== undefined
          ? { movidoParaRepiqueEm: extra.movidoParaRepiqueEm }
          : {}),
      },
    });
  }

  async markAtribuidoAutomaticamente(id: string, when: Date): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: { atribuidoAutomaticamenteEm: when, aceitoEm: null },
    });
  }

  async aceitarLead(id: string, when: Date): Promise<CardRecord> {
    const row = await this.prisma.card.update({ where: { id }, data: { aceitoEm: when } });
    return this.toRecord(row);
  }

  async reassignOwnerAfterTimeout(id: string, newOwnerId: string, when: Date): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: { ownerId: newOwnerId, atribuidoAutomaticamenteEm: when, aceitoEm: null },
    });
    return this.toRecord(row);
  }

  async clearAtribuidoAutomaticamente(id: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { atribuidoAutomaticamenteEm: null } });
  }

  async findPendentesDeAceite(): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { atribuidoAutomaticamenteEm: { not: null }, aceitoEm: null },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findElegiveisParaRepiqueJob(antesDe: Date): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        updatedAt: { lt: antesDe },
        emAtendimentoVivi: false,
        OR: [{ stageId: null }, { stage: { name: { notIn: PROTECTED_STAGE_NAMES } } }],
      },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findElegiveisParaCampanhaRepique(): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { stage: { name: REPIQUE_STAGE_NAME }, repiqueOptOut: false },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findInboxUnnotifiedOlderThan(antesDe: Date): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        stageId: null,
        ownerId: null,
        emAtendimentoVivi: false,
        OR: [
          { caixaEntradaDesde: { lt: antesDe } },
          { caixaEntradaDesde: null, createdAt: { lt: antesDe } },
        ],
        escalonamentoNotificadoEm: null,
      },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async markEscalonamentoNotificado(id: string): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: { escalonamentoNotificadoEm: new Date() },
    });
  }

  async findRepiqueCardByTenantAndPhone(tenantId: string, phone: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({
      where: { tenantId, phone, stage: { name: REPIQUE_STAGE_NAME } },
    });
    return row ? this.toRecord(row) : null;
  }

  async findByRepiqueOptOutToken(token: string): Promise<CardRecord | null> {
    const row = await this.prisma.card.findUnique({ where: { repiqueOptOutToken: token } });
    return row ? this.toRecord(row) : null;
  }

  async markRepiqueOptOut(id: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { repiqueOptOut: true } });
  }

  async setRepiqueOptOutToken(id: string, token: string): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { repiqueOptOutToken: token } });
  }

  async assignOwnerAndStage(
    id: string,
    input: { ownerId: string; stageId: string; position: number },
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: { ownerId: input.ownerId, stageId: input.stageId, position: input.position },
    });
    return this.toRecord(row);
  }

  async update(
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
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.temperatura !== undefined ? { temperatura: input.temperatura } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.endereco !== undefined ? { endereco: input.endereco } : {}),
        ...(input.numero !== undefined ? { numero: input.numero } : {}),
        ...(input.complemento !== undefined ? { complemento: input.complemento } : {}),
        ...(input.bairro !== undefined ? { bairro: input.bairro } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
        ...(input.imovelId !== undefined ? { imovelId: input.imovelId } : {}),
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.card.delete({ where: { id } });
  }


  async existsByTenantAndPhoneWithOwner(tenantId: string, phone: string): Promise<boolean> {
    const count = await this.prisma.card.count({
      where: {
        tenantId,
        phone,
        ownerId: { not: null },
      },
    });
    return count > 0;
  }

  async existsByTenantAndPhone(tenantId: string, phone: string): Promise<boolean> {
    const count = await this.prisma.card.count({ where: { tenantId, phone } });
    return count > 0;
  }

  async findByTenantPhoneAndPipeline(
    tenantId: string,
    phone: string,
    pipelineId: string,
  ): Promise<CardRecord | null> {
    const row = await this.prisma.card.findFirst({ where: { tenantId, phone, pipelineId } });
    return row ? this.toRecord(row) : null;
  }

  async moveToPipelineAndStage(
    id: string,
    input: {
      pipelineId: string;
      stageId: string | null;
      position: number;
      title?: string;
      description?: string;
      origem?: string;
      motivoRepique?: string | null;
      movidoParaRepiqueEm?: Date | null;
      empreendimentoId?: string | null;
    },
  ): Promise<CardRecord> {
    const row = await this.prisma.card.update({
      where: { id },
      data: {
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        position: input.position,
        // Fase B: entrou na Caixa de Entrada agora (alerta de 15 min conta daqui).
        ...(input.stageId === null ? { caixaEntradaDesde: new Date(), escalonamentoNotificadoEm: null } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.origem !== undefined ? { origem: input.origem } : {}),
        ...(input.motivoRepique !== undefined ? { motivoRepique: input.motivoRepique } : {}),
        ...(input.movidoParaRepiqueEm !== undefined
          ? { movidoParaRepiqueEm: input.movidoParaRepiqueEm }
          : {}),
        ...(input.empreendimentoId !== undefined ? { empreendimentoId: input.empreendimentoId } : {}),
      },
    });
    return this.toRecord(row);
  }

  async findAbertosPorTrechoTelefone(tenantId: string, trecho: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        tenantId,
        phone: { contains: trecho },
        pipeline: { name: { not: REMARKETING_PIPELINE_NOME } },
        OR: [{ stageId: null }, { stage: { name: { not: FECHAMENTO_STAGE_NAME } } }],
      },
      include: { stage: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({ ...this.toRecord(row), stageName: row.stage?.name ?? null }));
  }

  async moverParaCaixaDeEntrada(id: string): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: {
        stageId: null,
        ownerId: null,
        suggestedOwnerId: null,
        atribuidoAutomaticamenteEm: null,
        aceitoEm: null,
        escalonamentoNotificadoEm: null,
        caixaEntradaDesde: new Date(),
      },
    });
  }

  async findAtendimentoViviByPipeline(pipelineId: string): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: { pipelineId, emAtendimentoVivi: true },
      orderBy: { ultimaInteracaoViviEm: { sort: 'desc', nulls: 'last' } },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async marcarAtendimentoVivi(id: string, quando: Date): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: {
        emAtendimentoVivi: true,
        ultimaInteracaoViviEm: quando,
        stageId: null,
        ownerId: null,
        suggestedOwnerId: null,
        atribuidoAutomaticamenteEm: null,
        aceitoEm: null,
        escalonamentoNotificadoEm: null,
      },
    });
  }

  async registrarInteracaoVivi(id: string, quando: Date): Promise<void> {
    await this.prisma.card.update({ where: { id }, data: { ultimaInteracaoViviEm: quando } });
  }

  async sairDoAtendimentoVivi(id: string): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: { emAtendimentoVivi: false, caixaEntradaDesde: new Date(), escalonamentoNotificadoEm: null },
    });
  }

  async findAtendimentoViviSemInteracaoDesde(antesDe: Date): Promise<CardRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        emAtendimentoVivi: true,
        OR: [
          { ultimaInteracaoViviEm: { lt: antesDe } },
          { ultimaInteracaoViviEm: null, createdAt: { lt: antesDe } },
        ],
      },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async atualizarDadosDeEntrada(
    id: string,
    dados: { title?: string; description?: string; empreendimentoId?: string | null },
  ): Promise<void> {
    const data: Prisma.CardUpdateInput = {};
    if (dados.title !== undefined) data.title = dados.title;
    if (dados.description !== undefined) data.description = dados.description;
    if (dados.empreendimentoId !== undefined) {
      data.empreendimento = dados.empreendimentoId
        ? { connect: { id: dados.empreendimentoId } }
        : { disconnect: true };
    }
    if (Object.keys(data).length === 0) return;
    await this.prisma.card.update({ where: { id }, data });
  }

  async reatribuirSeAindaPendente(
    id: string,
    novoDonoId: string,
    quando: Date,
    donoAtual: string | null,
  ): Promise<boolean> {
    const r = await this.prisma.card.updateMany({
      // Ainda aguardando aceite E com o mesmo dono lido (ninguem aceitou nem
      // repassou a mao no meio do caminho).
      where: { id, aceitoEm: null, ownerId: donoAtual, atribuidoAutomaticamenteEm: { not: null } },
      data: { ownerId: novoDonoId, atribuidoAutomaticamenteEm: quando, aceitoEm: null },
    });
    return r.count > 0;
  }

  async moverDoAtendimentoViviParaRepique(id: string, repiqueStageId: string, quando: Date): Promise<void> {
    await this.prisma.card.update({
      where: { id },
      data: {
        emAtendimentoVivi: false,
        stageId: repiqueStageId,
        position: 0,
        motivoRepique: 'SEM_RESPOSTA_VIVI',
        movidoParaRepiqueEm: quando,
      },
    });
  }
}
