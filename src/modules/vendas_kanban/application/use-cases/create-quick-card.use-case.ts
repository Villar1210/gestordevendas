// src/modules/vendas_kanban/application/use-cases/create-quick-card.use-case.ts
// Cria um card "cru", sem stage e sem dono (Caixa de Entrada). Representa a
// chegada de um lead ainda nao qualificado - hoje disparado manualmente para
// testes, no futuro sera o ponto de entrada dos webhooks de redes sociais.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface CreateQuickCardInput {
  tenantId: string;
  pipelineId: string;
  title: string;
  value?: number;
  origem?: string;
  phone?: string;
  temperatura?: string;
  imovelId?: string;
  customFields?: Record<string, unknown>;
}

@Injectable()
export class CreateQuickCardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: CreateQuickCardInput): Promise<CardRecord> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    return this.cardRepository.create({
      tenantId: input.tenantId,
      pipelineId: pipeline.id,
      stageId: null,
      ownerId: null,
      title: input.title,
      value: input.value,
      origem: input.origem ?? 'webhook',
      phone: input.phone,
      temperatura: input.temperatura,
      imovelId: input.imovelId,
      customFields: input.customFields,
      position: 0,
    });
  }
}
