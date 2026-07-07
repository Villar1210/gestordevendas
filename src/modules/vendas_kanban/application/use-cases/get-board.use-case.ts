// src/modules/vendas_kanban/application/use-cases/get-board.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface GetBoardInput {
  pipelineId: string;
  tenantId: string;
}

export interface BoardStage {
  id: string;
  name: string;
  position: number;
  cards: CardRecord[];
}

export interface BoardResult {
  id: string;
  name: string;
  createdAt: Date;
  stages: BoardStage[];
}

@Injectable()
export class GetBoardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: GetBoardInput): Promise<BoardResult> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    const stages = await this.stageRepository.findAllByPipeline(pipeline.id);

    const stagesWithCards: BoardStage[] = await Promise.all(
      stages.map(async (stage) => ({
        id: stage.id,
        name: stage.name,
        position: stage.position,
        cards: await this.cardRepository.findAllByStage(stage.id),
      })),
    );

    return {
      id: pipeline.id,
      name: pipeline.name,
      createdAt: pipeline.createdAt,
      stages: stagesWithCards,
    };
  }
}
