// src/modules/vendas_kanban/application/use-cases/get-inbox.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface GetInboxInput {
  tenantId: string;
  pipelineId: string;
}

@Injectable()
export class GetInboxUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: GetInboxInput): Promise<CardRecord[]> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    return this.cardRepository.findAllByPipelineInbox(pipeline.id);
  }
}
