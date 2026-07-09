// src/modules/vendas_kanban/application/use-cases/get-inbox.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface GetInboxInput {
  tenantId: string;
  pipelineId: string;
  // Aceitos por simetria com GetBoardUseCase, mas NAO usados para filtrar:
  // a Caixa de Entrada mostra todos os cards sem dono para qualquer role,
  // Corretor incluido - e assim que o corretor "reivindica" um lead (ver
  // ClaimCardUseCase e a nota sobre Caixa de Entrada no CLAUDE.md).
  requesterRole: string;
  requesterUserId: string;
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
