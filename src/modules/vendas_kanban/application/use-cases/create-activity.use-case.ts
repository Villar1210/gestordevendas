// src/modules/vendas_kanban/application/use-cases/create-activity.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { AcessoCardService, RequisitanteCard } from '../services/acesso-card.service';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import {
  IActivityRepository,
  ActivityRecord,
} from '../../domain/repositories/activity-repository.interface';

interface CreateActivityInput {
  tenantId: string;
  cardId: string;
  type: string;
  subject?: string;
  scheduledAt?: Date;
  // Quem pediu (rota HTTP). Ausente = chamada interna do sistema (VIVI,
  // jobs), sem checagem de dono - ver application/services/acesso-card.service.ts.
  requisitante?: RequisitanteCard;
}

@Injectable()
export class CreateActivityUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
    private readonly acessoCardService: AcessoCardService,
  ) {}

  async execute(input: CreateActivityInput): Promise<ActivityRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.acessoCardService.garantir(input.tenantId, card.ownerId, input.requisitante, 'alterar');

    return this.activityRepository.create({
      tenantId: input.tenantId,
      cardId: input.cardId,
      type: input.type,
      subject: input.subject,
      scheduledAt: input.scheduledAt,
    });
  }
}
