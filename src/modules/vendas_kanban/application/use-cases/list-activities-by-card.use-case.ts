// src/modules/vendas_kanban/application/use-cases/list-activities-by-card.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import {
  IActivityRepository,
  ActivityRecord,
} from '../../domain/repositories/activity-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

interface ListActivitiesByCardInput {
  tenantId: string;
  cardId: string;
  requesterRole: string;
  requesterCargo: string | null;
}

@Injectable()
export class ListActivitiesByCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(input: ListActivitiesByCardInput): Promise<ActivityRecord[]> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    const pipeline = await this.pipelineRepository.findByIdAndTenant(card.pipelineId, input.tenantId);
    if (
      pipeline?.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    return this.activityRepository.findAllByCard(input.cardId);
  }
}
