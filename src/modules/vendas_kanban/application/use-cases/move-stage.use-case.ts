// src/modules/vendas_kanban/application/use-cases/move-stage.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';

const POSITION_STEP = 1000;

interface MoveStageInput {
  stageId: string;
  tenantId: string;
  targetIndex: number;
}

@Injectable()
export class MoveStageUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
  ) {}

  async execute(input: MoveStageInput): Promise<{ newPosition: number }> {
    const stage = await this.stageRepository.findByIdAndTenant(input.stageId, input.tenantId);
    if (!stage) {
      throw new NotFoundException('Stage nao encontrada.');
    }

    const siblingStages = (
      await this.stageRepository.findAllByPipeline(stage.pipelineId)
    ).filter((s) => s.id !== stage.id);

    const newPosition = this.calculatePosition(siblingStages, input.targetIndex);

    await this.stageRepository.updatePosition(stage.id, newPosition);

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
