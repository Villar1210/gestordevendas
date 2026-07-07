// src/modules/vendas_kanban/application/use-cases/create-pipeline.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';

interface CreatePipelineInput {
  tenantId: string;
  name: string;
}

@Injectable()
export class CreatePipelineUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  async execute(input: CreatePipelineInput): Promise<PipelineRecord> {
    return this.pipelineRepository.create({ tenantId: input.tenantId, name: input.name });
  }
}
