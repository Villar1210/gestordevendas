// src/modules/vendas_kanban/application/use-cases/create-default-pipeline.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IPipelineRepository,
  PipelineRecord,
} from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';

// "Repique" e sempre a ULTIMA coluna do board - deposito estrategico de
// leads sem perfil de renda para nenhuma faixa de financiamento hoje (ver
// domain/services/classificar-renda.ts no modulo vivi_sdr), para
// remarketing futuro. Sem cor propria no banco (Stage nao tem campo de
// cor) - a coluna ja renderiza neutra/cinza, igual as demais (ver
// KanbanColumn.tsx), entao nao precisa de nenhum tratamento visual extra.
const DEFAULT_STAGE_NAMES = [
  'Em Atendimento',
  'Qualificacao',
  'Analise de Credito',
  'Negociacao',
  'Fechamento',
  'Repique',
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
