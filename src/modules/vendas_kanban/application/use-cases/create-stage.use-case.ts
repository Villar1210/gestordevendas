// src/modules/vendas_kanban/application/use-cases/create-stage.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository, StageRecord } from '../../domain/repositories/stage-repository.interface';

const POSITION_STEP = 1000;

interface CreateStageInput {
  tenantId: string;
  pipelineId: string;
  name: string;
}

@Injectable()
export class CreateStageUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
  ) {}

  async execute(input: CreateStageInput): Promise<StageRecord> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    const existingStages = await this.stageRepository.findAllByPipeline(input.pipelineId);
    const lastPosition = existingStages.length
      ? existingStages[existingStages.length - 1].position
      : 0;

    return this.stageRepository.create({
      tenantId: input.tenantId,
      pipelineId: input.pipelineId,
      name: input.name,
      position: lastPosition + POSITION_STEP,
    });
  }
}
