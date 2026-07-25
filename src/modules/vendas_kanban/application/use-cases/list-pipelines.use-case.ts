// src/modules/vendas_kanban/application/use-cases/list-pipelines.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

interface ListPipelinesInput {
  tenantId: string;
  // Usado so para decidir se o funil de remarketing (captura automatica de
  // lead minimo) aparece na lista - ver
  // domain/services/remarketing-pipeline.ts. Opcionais (nao obrigatorios)
  // para nao quebrar nenhum outro chamador existente deste use case;
  // omitidos, o filtro se aplica como se o requester NAO tivesse acesso
  // (mais restritivo por padrao).
  requesterRole?: string;
  requesterCargo?: string | null;
}

@Injectable()
export class ListPipelinesUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  async execute(input: ListPipelinesInput): Promise<PipelineRecord[]> {
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);

    const podeVerRemarketing = podeAcessarPipelineRemarketing(
      input.requesterRole ?? '',
      input.requesterCargo ?? null,
    );
    if (podeVerRemarketing) {
      return pipelines;
    }
    return pipelines.filter((pipeline) => pipeline.name !== REMARKETING_PIPELINE_NOME);
  }
}
