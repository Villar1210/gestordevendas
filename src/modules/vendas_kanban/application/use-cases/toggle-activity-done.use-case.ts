// src/modules/vendas_kanban/application/use-cases/toggle-activity-done.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IActivityRepository,
  ActivityRecord,
} from '../../domain/repositories/activity-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { AcessoCardService, RequisitanteCard } from '../services/acesso-card.service';

interface ToggleActivityDoneInput {
  activityId: string;
  tenantId: string;
  // Quem pediu (rota HTTP) - ver application/services/acesso-card.service.ts.
  requisitante?: RequisitanteCard;
}

@Injectable()
export class ToggleActivityDoneUseCase {
  constructor(
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly acessoCardService: AcessoCardService,
  ) {}

  async execute(input: ToggleActivityDoneInput): Promise<ActivityRecord> {
    const activity = await this.activityRepository.findByIdAndTenant(
      input.activityId,
      input.tenantId,
    );
    if (!activity) {
      throw new NotFoundException('Atividade nao encontrada.');
    }

    const card = await this.cardRepository.findByIdAndTenant(activity.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Atividade nao encontrada.');
    }
    await this.acessoCardService.garantir(input.tenantId, card.ownerId, input.requisitante, 'alterar');

    return this.activityRepository.setDone(activity.id, !activity.done);
  }
}
