// src/modules/vendas_kanban/application/use-cases/get-board.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface GetBoardInput {
  pipelineId: string;
  tenantId: string;
  // Quem esta pedindo o board - usado para restringir a visibilidade dos
  // cards por dono quando o role for "Corretor" (ver CLAUDE.md, modulo RH).
  requesterRole: string;
  requesterUserId: string;
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

    // Corretor so ve os proprios cards nas colunas do Kanban; Administrador
    // ve tudo, sem filtro. A Caixa de Entrada (GetInboxUseCase) nao aplica
    // este filtro - todo corretor pode ver e reivindicar leads sem dono.
    const isCorretor = input.requesterRole === 'Corretor';

    const stagesWithCards: BoardStage[] = await Promise.all(
      stages.map(async (stage) => {
        const cards = await this.cardRepository.findAllByStage(stage.id);
        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          cards: isCorretor
            ? cards.filter((card) => card.ownerId === input.requesterUserId)
            : cards,
        };
      }),
    );

    return {
      id: pipeline.id,
      name: pipeline.name,
      createdAt: pipeline.createdAt,
      stages: stagesWithCards,
    };
  }
}
