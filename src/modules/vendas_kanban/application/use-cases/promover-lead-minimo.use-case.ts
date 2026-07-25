// src/modules/vendas_kanban/application/use-cases/promover-lead-minimo.use-case.ts
// "Promove" (MUTA o mesmo Card, nunca duplica) o Card de captura automatica
// do funil de remarketing (ver CapturarLeadMinimoUseCase) para o pipeline
// real informado pelo chamador, quando a VIVI efetivamente qualifica ou
// agenda visita para o mesmo telefone. Chamado nos 2 unicos pontos que hoje
// criam Card a partir de uma conversa da VIVI (transferToBroker, em
// ProcessIncomingMessageUseCase, e AgendarVisitaUseCase) - decisao
// confirmada com o usuario, ja que "salvar_dados_lead" nunca cria Card
// sozinho.
//
// Se nao existir nenhum Card de captura automatica para este telefone
// (contato que qualificou direto, sem nunca ter passado pelo funil de
// remarketing), retorna null - o chamador cai no caminho ja existente de
// criar um Card novo, comportamento identico ao de antes desta fatia.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { REMARKETING_PIPELINE_NOME } from '../../domain/services/remarketing-pipeline';

interface PromoverLeadMinimoInput {
  tenantId: string;
  phoneNumber: string;
  targetPipelineId: string;
  targetStageId: string | null;
  position: number;
  title?: string;
  description?: string;
  origem?: string;
  motivoRepique?: string | null;
}

@Injectable()
export class PromoverLeadMinimoUseCase {
  private readonly logger = new Logger(PromoverLeadMinimoUseCase.name);

  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: PromoverLeadMinimoInput): Promise<CardRecord | null> {
    if (!input.phoneNumber) return null;

    // Busca so por LEITURA (nunca cria) - se o pipeline de remarketing
    // nunca existiu para este tenant, nenhuma captura automatica jamais
    // aconteceu, entao nao ha nada para promover.
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    const remarketingPipeline = pipelines.find((p) => p.name === REMARKETING_PIPELINE_NOME);
    if (!remarketingPipeline) {
      return null;
    }

    const cardRemarketing = await this.cardRepository.findByTenantPhoneAndPipeline(
      input.tenantId,
      input.phoneNumber,
      remarketingPipeline.id,
    );
    if (!cardRemarketing) {
      return null;
    }

    const cardPromovido = await this.cardRepository.moveToPipelineAndStage(cardRemarketing.id, {
      pipelineId: input.targetPipelineId,
      stageId: input.targetStageId,
      position: input.position,
      title: input.title,
      description: input.description,
      origem: input.origem,
      motivoRepique: input.motivoRepique ?? null,
      movidoParaRepiqueEm: input.motivoRepique ? new Date() : null,
    });

    this.logger.log(
      `[Remarketing] Card ${cardPromovido.id} promovido do funil de remarketing para o pipeline ${input.targetPipelineId} (telefone ${input.phoneNumber}).`,
    );

    // Mesma condicao ja usada por CreateQuickCardUseCase: so dispara a
    // Roleta Online se o card promovido caiu na Caixa de Entrada (sem
    // stage) - um card promovido direto para "Repique" (motivo sem_perfil)
    // NAO deve ser distribuido.
    if (!cardPromovido.stageId) {
      this.eventEmitter.emit('card.sem_dono.criado', {
        tenantId: input.tenantId,
        cardId: cardPromovido.id,
        pipelineId: input.targetPipelineId,
      });
    }

    return cardPromovido;
  }
}
