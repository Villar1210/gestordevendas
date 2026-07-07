// src/modules/vendas_kanban/application/use-cases/create-default-pipeline.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';

const DEFAULT_STAGE_NAMES = [
  'Em Atendimento',
  'Qualificacao',
  'Analise de Credito',
  'Negociacao',
  'Fechamento',
];
const POSITION_STEP = 1000;

interface CreateDefaultPipelineInput {
  tenantId: string;
}

@Injectable()
export class CreateDefaultPipelineUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
  ) {}

  async execute(input: CreateDefaultPipelineInput): Promise<PipelineRecord> {
    const pipeline = await this.pipelineRepository.create({
      tenantId: input.tenantId,
      name: 'Vendas Imoveis',
    });

    for (let i = 0; i < DEFAULT_STAGE_NAMES.length; i++) {
      await this.stageRepository.create({
        tenantId: input.tenantId,
        pipelineId: pipeline.id,
        name: DEFAULT_STAGE_NAMES[i],
        position: (i + 1) * POSITION_STEP,
      });
    }

    return pipeline;
  }
}
