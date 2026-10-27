// src/modules/vendas_kanban/application/use-cases/atendimento-vivi-gestao.use-cases.ts
// Fase B (27/10/2026): coluna "Atendimento VIVI" no Kanban.
// - ListAtendimentoViviUseCase: todos do dashboard VEEM a coluna (o corretor
//   so visualiza - decisao do dono).
// - EncaminharAtendimentoViviParaRoletaUseCase: so a gestao (coordenador para
//   cima e Administrador) tira um lead da VIVI e manda direto para a Roleta.
// - MoverAtendimentoViviParadoParaRepiqueUseCase: 7 dias sem interacao com a
//   VIVI -> etapa Repique do funil, motivo SEM_RESPOSTA_VIVI.
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CardRecord, ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { CARD_STAGE_CHANGED_EVENT, CardStageChangedEvent } from '../../domain/events/card-stage-changed.event';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

export const DIAS_SEM_RESPOSTA_ATENDIMENTO_VIVI = 7;

@Injectable()
export class ListAtendimentoViviUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  async execute(input: { tenantId: string; pipelineId: string }): Promise<CardRecord[]> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(input.pipelineId, input.tenantId);
    if (!pipeline || pipeline.name === REMARKETING_PIPELINE_NOME) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }
    return this.cardRepository.findAtendimentoViviByPipeline(pipeline.id);
  }
}

@Injectable()
export class EncaminharAtendimentoViviParaRoletaUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: {
    tenantId: string;
    cardId: string;
    requesterRole: string;
    requesterCargo: string | null;
  }): Promise<CardRecord> {
    if (resolveEscopo(input.requesterRole, input.requesterCargo) === 'proprio') {
      throw new ForbiddenException('Somente a gestão encaminha leads da VIVI para a Roleta.');
    }
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) throw new NotFoundException('Card nao encontrado.');
    if (!card.emAtendimentoVivi) {
      throw new BadRequestException('Este lead não está em atendimento pela VIVI.');
    }
    await this.promover(card);
    return (await this.cardRepository.findByIdAndTenant(card.id, input.tenantId)) ?? card;
  }

  // Chamada do sistema (ex.: VIVI agendou visita citando o card pelo id): se o
  // card ainda estiver na coluna, sai dela e vai para a Roleta. Senao, nada.
  async encaminharPeloSistema(
    tenantId: string,
    cardId: string,
    dados?: { description?: string; empreendimentoId?: string | null },
  ): Promise<void> {
    const card = await this.cardRepository.findByIdAndTenant(cardId, tenantId);
    if (card?.emAtendimentoVivi) {
      // Resumo e produto antes da Roleta (o produto decide a roleta do sorteio).
      await this.cardRepository.atualizarDadosDeEntrada(card.id, {
        description: dados?.description?.trim() ? dados.description.trim() : undefined,
        empreendimentoId: dados?.empreendimentoId ? dados.empreendimentoId : undefined,
      });
      await this.promover(card);
    }
  }

  private async promover(card: CardRecord): Promise<void> {
    await this.cardRepository.sairDoAtendimentoVivi(card.id);
    await this.eventEmitter.emitAsync('card.sem_dono.criado', {
      tenantId: card.tenantId,
      cardId: card.id,
      pipelineId: card.pipelineId,
    });
  }
}

@Injectable()
export class MoverAtendimentoViviParadoParaRepiqueUseCase {
  private readonly logger = new Logger(MoverAtendimentoViviParadoParaRepiqueUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(agora: Date = new Date()): Promise<number> {
    const antesDe = new Date(agora.getTime() - DIAS_SEM_RESPOSTA_ATENDIMENTO_VIVI * 24 * 60 * 60 * 1000);
    const parados = await this.cardRepository.findAtendimentoViviSemInteracaoDesde(antesDe);
    let movidos = 0;
    for (const card of parados) {
      try {
        const stages = await this.stageRepository.findAllByPipeline(card.pipelineId);
        const repique = stages.find((s) => s.name === REPIQUE_STAGE_NAME);
        if (!repique) {
          this.logger.warn(`Funil ${card.pipelineId} sem etapa Repique - card ${card.id} continua na VIVI.`);
          continue;
        }
        await this.cardRepository.moverDoAtendimentoViviParaRepique(card.id, repique.id, agora);
        const evento: CardStageChangedEvent = {
          tenantId: card.tenantId,
          cardId: card.id,
          pipelineId: card.pipelineId,
          fromStageId: null,
          toStageId: repique.id,
          userId: null,
          origem: 'job_repique',
          ocorridoEm: agora,
          motivoRepique: 'SEM_RESPOSTA_VIVI',
        };
        this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);
        movidos++;
      } catch (err) {
        this.logger.error(`Falha movendo card ${card.id} da VIVI para o Repique: ${(err as Error).message}`);
      }
    }
    return movidos;
  }
}
