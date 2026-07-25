// src/modules/vendas_kanban/application/use-cases/get-or-create-remarketing-pipeline.use-case.ts
// Garante a existencia do pipeline "Leads Nao Qualificados" + sua unica
// stage "Aguardando Reengajamento" para o tenant, criando na primeira vez
// que a captura automatica de lead minimo precisa dele (mesmo idioma
// "get or create" ja usado por GetOrCreateAtendimentoUseCase para as filas
// padrao da Central de Atendimento, modulo atendimento) - diferente de
// CreateDefaultPipelineUseCase (que cria o pipeline de vendas UMA VEZ, no
// onboarding do tenant), este roda sob demanda, no primeiro contato
// capturado automaticamente.
import { Injectable, Inject } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  REMARKETING_STAGE_NOME,
} from '../../domain/services/remarketing-pipeline';

interface GetOrCreateRemarketingPipelineInput {
  tenantId: string;
}

interface GetOrCreateRemarketingPipelineOutput {
  pipelineId: string;
  stageId: string;
}

@Injectable()
export class GetOrCreateRemarketingPipelineUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
  ) {}

  async execute(
    input: GetOrCreateRemarketingPipelineInput,
  ): Promise<GetOrCreateRemarketingPipelineOutput> {
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    let pipeline = pipelines.find((p) => p.name === REMARKETING_PIPELINE_NOME) ?? null;
    if (!pipeline) {
      pipeline = await this.pipelineRepository.create({
        tenantId: input.tenantId,
        name: REMARKETING_PIPELINE_NOME,
      });
    }

    const stages = await this.stageRepository.findAllByPipeline(pipeline.id);
    let stage = stages.find((s) => s.name === REMARKETING_STAGE_NOME) ?? null;
    if (!stage) {
      stage = await this.stageRepository.create({
        tenantId: input.tenantId,
        pipelineId: pipeline.id,
        name: REMARKETING_STAGE_NOME,
        position: 1000,
      });
    }

    return { pipelineId: pipeline.id, stageId: stage.id };
  }
}
