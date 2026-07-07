// src/modules/vendas_kanban/application/use-cases/move-card.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';

const POSITION_STEP = 1000;

interface MoveCardInput {
  cardId: string;
  tenantId: string;
  targetStageId: string;
  targetIndex: number;
}

@Injectable()
export class MoveCardUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: MoveCardInput): Promise<{ newPosition: number }> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    const targetStage = await this.stageRepository.findByIdAndTenant(
      input.targetStageId,
      input.tenantId,
    );
    if (!targetStage) {
      throw new NotFoundException('Stage de destino nao encontrada.');
    }

    const cardsInTargetStage = (
      await this.cardRepository.findAllByStage(input.targetStageId)
    ).filter((c) => c.id !== card.id);

    const newPosition = this.calculatePosition(cardsInTargetStage, input.targetIndex);

    await this.cardRepository.updateStageAndPosition(card.id, input.targetStageId, newPosition);

    return { newPosition };
  }

  private calculatePosition(
    orderedSiblings: { position: number }[],
    targetIndex: number,
  ): number {
    if (orderedSiblings.length === 0) {
      return POSITION_STEP;
    }

    if (targetIndex === 0) {
      return orderedSiblings[0].position / 2;
    }

    if (targetIndex >= orderedSiblings.length) {
      return orderedSiblings[orderedSiblings.length - 1].position + POSITION_STEP;
    }

    return (orderedSiblings[targetIndex - 1].position + orderedSiblings[targetIndex].position) / 2;
  }
}
