// src/modules/vendas_kanban/application/use-cases/toggle-activity-done.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IActivityRepository,
  ActivityRecord,
} from '../../domain/repositories/activity-repository.interface';

interface ToggleActivityDoneInput {
  activityId: string;
  tenantId: string;
}

@Injectable()
export class ToggleActivityDoneUseCase {
  constructor(
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(input: ToggleActivityDoneInput): Promise<ActivityRecord> {
    const activity = await this.activityRepository.findByIdAndTenant(
      input.activityId,
      input.tenantId,
    );
    if (!activity) {
      throw new NotFoundException('Atividade nao encontrada.');
    }

    return this.activityRepository.setDone(activity.id, !activity.done);
  }
}
