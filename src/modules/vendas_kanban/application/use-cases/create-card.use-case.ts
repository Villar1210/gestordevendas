// src/modules/vendas_kanban/application/use-cases/create-card.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import {
  CARD_STAGE_CHANGED_EVENT,
  CardStageChangedEvent,
} from '../../domain/events/card-stage-changed.event';
import { CardAbertoPorTelefoneService } from '../services/card-aberto-por-telefone.service';
import { conflitoNovoNegocio } from '../../domain/services/conflito-novo-negocio';

const POSITION_STEP = 1000;

interface CreateCardInput {
  tenantId: string;
  ownerId: string;
  // Uso "dentro de uma coluna" (+ Novo Card): informa stageId diretamente.
  stageId?: string;
  // Uso "no cabecalho" (+ Novo Negocio): informa so o pipeline, o card
  // entra direto na primeira stage (menor position) desse pipeline.
  pipelineId?: string;
  title: string;
  value?: number;
  origem?: string;
  phone?: string;
  temperatura?: string;
  imovelId?: string;
  customFields?: Record<string, unknown>;
}

@Injectable()
export class CreateCardUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly cardAbertoPorTelefone: CardAbertoPorTelefoneService,
  ) {}

  async execute(input: CreateCardInput): Promise<CardRecord> {
    if (!input.stageId && !input.pipelineId) {
      throw new BadRequestException('Informe stageId ou pipelineId.');
    }

    const targetStage = input.stageId
      ? await this.stageRepository.findByIdAndTenant(input.stageId, input.tenantId)
      : (await this.stageRepository.findAllByPipeline(input.pipelineId!))[0];

    if (!targetStage) {
      throw new NotFoundException(
        input.stageId ? 'Stage nao encontrada.' : 'Pipeline nao possui nenhuma stage.',
      );
    }

    // Fase B (27/10/2026): "+ Novo Negocio" nao duplica cliente que ja tem
    // negocio aberto (de qualquer corretor ou na Caixa de Entrada).
    await this.garantirTelefoneSemNegocioAberto(input.tenantId, input.ownerId, input.phone, targetStage.pipelineId);

    const existingCards = await this.cardRepository.findAllByStage(targetStage.id);
    const lastPosition = existingCards.length
      ? existingCards[existingCards.length - 1].position
      : 0;

    const card = await this.cardRepository.create({
      tenantId: input.tenantId,
      pipelineId: targetStage.pipelineId,
      stageId: targetStage.id,
      ownerId: input.ownerId,
      title: input.title,
      value: input.value,
      origem: input.origem,
      phone: input.phone,
      temperatura: input.temperatura,
      imovelId: input.imovelId,
      customFields: input.customFields,
      position: lastPosition + POSITION_STEP,
    });

    // Historico de etapas (BII): card ja nasce numa stage (entrada no funil).
    const evento: CardStageChangedEvent = {
      tenantId: input.tenantId,
      cardId: card.id,
      pipelineId: card.pipelineId,
      fromStageId: null,
      toStageId: targetStage.id,
      userId: input.ownerId,
      origem: 'criacao',
      ocorridoEm: new Date(),
    };
    this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);

    return card;
  }

  private async garantirTelefoneSemNegocioAberto(
    tenantId: string,
    ownerId: string,
    phone: string | undefined,
    pipelineId: string,
  ): Promise<void> {
    const aberto = await this.cardAbertoPorTelefone.encontrar(tenantId, phone, pipelineId);
    if (!aberto) return;
    const conflito = conflitoNovoNegocio(aberto, ownerId, { permitirProprio: true });
    if (conflito) throw new ConflictException(conflito);
  }
}
