// src/modules/vendas_kanban/application/use-cases/list-pipelines.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';

interface ListPipelinesInput {
  tenantId: string;
}

@Injectable()
export class ListPipelinesUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  async execute(input: ListPipelinesInput): Promise<PipelineRecord[]> {
    return this.pipelineRepository.findAllByTenant(input.tenantId);
  }
}
