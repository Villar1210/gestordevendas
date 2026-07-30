// src/modules/vendas_kanban/application/use-cases/claim-card.use-case.ts
// "Assumir o lead": atribui o usuario logado como dono e move o card da
// Caixa de Entrada direto para a primeira stage do pipeline, em uma unica acao.
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

const POSITION_STEP = 1000;

interface ClaimCardInput {
  cardId: string;
  tenantId: string;
  userId: string;
  requesterRole: string;
  requesterCargo: string | null;
}

@Injectable()
export class ClaimCardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: ClaimCardInput): Promise<CardRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    if (card.ownerId) {
      throw new ConflictException('Lead ja foi assumido por outro corretor.');
    }

    // Restricao de visibilidade do funil de remarketing (ver
    // domain/services/remarketing-pipeline.ts) - mesma checagem ja aplicada
    // em GetBoardUseCase, aqui reforcada contra "claim" direto por cardId
    // (que nao passa pelo board nem pela Caixa de Entrada do pipeline).
    const pipeline = await this.pipelineRepository.findByIdAndTenant(card.pipelineId, input.tenantId);
    if (
      pipeline?.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    const [firstStage] = await this.stageRepository.findAllByPipeline(card.pipelineId);
    if (!firstStage) {
      throw new NotFoundException('Pipeline nao possui nenhuma stage.');
    }

    const existingCards = await this.cardRepository.findAllByStage(firstStage.id);
    const lastPosition = existingCards.length
      ? existingCards[existingCards.length - 1].position
      : 0;

    return this.cardRepository.assignOwnerAndStage(card.id, {
      ownerId: input.userId,
      stageId: firstStage.id,
      position: lastPosition + POSITION_STEP,
    });
  }
}
