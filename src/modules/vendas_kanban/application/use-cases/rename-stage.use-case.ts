// src/modules/vendas_kanban/application/use-cases/rename-stage.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IStageRepository, StageRecord } from '../../domain/repositories/stage-repository.interface';
import { isProtectedStageName } from '../../domain/services/protected-stages';

interface RenameStageInput {
  stageId: string;
  tenantId: string;
  name: string;
}

@Injectable()
export class RenameStageUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
  ) {}

  async execute(input: RenameStageInput): Promise<StageRecord> {
    const stage = await this.stageRepository.findByIdAndTenant(input.stageId, input.tenantId);
    if (!stage) {
      throw new NotFoundException('Stage nao encontrada.');
    }

    if (isProtectedStageName(stage.name)) {
      throw new BadRequestException(
        `A coluna "${stage.name}" nao pode ser renomeada - ela e usada por outras funcionalidades do sistema (Roleta Online ou VIVI).`,
      );
    }

    await this.stageRepository.updateName(stage.id, input.name);

    return { ...stage, name: input.name };
  }
}
