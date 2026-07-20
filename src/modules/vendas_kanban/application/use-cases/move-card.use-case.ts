// src/modules/vendas_kanban/application/use-cases/move-card.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { MOTIVOS_REPIQUE, isMotivoRepiqueValido } from '../../domain/services/motivo-repique';

const POSITION_STEP = 1000;

interface MoveCardInput {
  cardId: string;
  tenantId: string;
  targetStageId: string;
  targetIndex: number;
  // Obrigatorio quando a stage de destino e "Repique" - ver
  // domain/services/motivo-repique.ts. Defesa em profundidade: o frontend
  // ja bloqueia isso via modal (ver MotivoRepiqueModal.tsx), mas o backend
  // valida de novo, mesmo padrao ja usado em outras regras de negocio
  // deste projeto (ex: AceitarLeadUseCase).
  motivoRepique?: string;
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

    if (targetStage.name === REPIQUE_STAGE_NAME) {
      if (!input.motivoRepique || !isMotivoRepiqueValido(input.motivoRepique)) {
        throw new BadRequestException(
          `Motivo obrigatorio ao mover para Repique. Use um destes: ${MOTIVOS_REPIQUE.join(', ')}.`,
        );
      }
      await this.cardRepository.updateStageAndPosition(card.id, input.targetStageId, newPosition, {
        motivoRepique: input.motivoRepique,
        movidoParaRepiqueEm: new Date(),
      });
    } else {
      await this.cardRepository.updateStageAndPosition(card.id, input.targetStageId, newPosition);
    }

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
