// src/modules/vendas_kanban/application/use-cases/list-activities-by-card.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AcessoCardService, RequisitanteCard } from '../services/acesso-card.service';
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
  // Quem pediu (rota HTTP). Ausente = chamada interna do sistema (VIVI,
  // jobs), sem checagem de dono - ver application/services/acesso-card.service.ts.
  requisitante?: RequisitanteCard;
}

@Injectable()
export class ListActivitiesByCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
    private readonly acessoCardService: AcessoCardService,
  ) {}

  async execute(input: ListActivitiesByCardInput): Promise<ActivityRecord[]> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.acessoCardService.garantir(input.tenantId, card.ownerId, input.requisitante, 'ver');

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
