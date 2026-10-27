// src/modules/vendas_kanban/application/use-cases/move-card.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AcessoCardService, RequisitanteCard } from '../services/acesso-card.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { MOTIVOS_REPIQUE, isMotivoRepiqueValido } from '../../domain/services/motivo-repique';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';
import {
  CARD_STAGE_CHANGED_EVENT,
  CardStageChangedEvent,
} from '../../domain/events/card-stage-changed.event';

const POSITION_STEP = 1000;

interface MoveCardInput {
  cardId: string;
  tenantId: string;
  targetStageId: string;
  targetIndex: number;
  requesterRole: string;
  requesterCargo: string | null;
  // Obrigatorio quando a stage de destino e "Repique" - ver
  // domain/services/motivo-repique.ts. Defesa em profundidade: o frontend
  // ja bloqueia isso via modal (ver MotivoRepiqueModal.tsx), mas o backend
  // valida de novo, mesmo padrao ja usado em outras regras de negocio
  // deste projeto (ex: AceitarLeadUseCase).
  motivoRepique?: string;
  // Quem moveu (evento card.stage.changed, consumido pelo BII). Opcional:
  // chamadores de sistema (ex: MoverCardViviUseCase) nao informam -> null.
  requesterUserId?: string | null;
  // Quem pediu (rota HTTP). Ausente = chamada interna do sistema (VIVI,
  // jobs), sem checagem de dono - ver application/services/acesso-card.service.ts.
  requisitante?: RequisitanteCard;
}

@Injectable()
export class MoveCardUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly acessoCardService: AcessoCardService,
  ) {}

  async execute(input: MoveCardInput): Promise<{ newPosition: number }> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.acessoCardService.garantir(input.tenantId, card.ownerId, input.requisitante, 'alterar');

    // Restricao de acesso ao pipeline de remarketing (ver
    // domain/services/remarketing-pipeline.ts) - so o lado do card de
    // ORIGEM importa aqui: updateStageAndPosition (abaixo) nunca altera
    // pipelineId, entao nao existe "mover entre pipelines" nesta operacao,
    // so mudanca de stage/posicao dentro do pipeline que o card ja esta.
    const cardPipeline = await this.pipelineRepository.findByIdAndTenant(
      card.pipelineId,
      input.tenantId,
    );
    if (
      cardPipeline?.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    const targetStage = await this.stageRepository.findByIdAndTenant(
      input.targetStageId,
      input.tenantId,
    );
    if (!targetStage) {
      throw new NotFoundException('Stage de destino nao encontrada.');
    }

    // Integridade de dado, nao permissao (por isso BadRequestException, nao
    // ForbiddenException - mesmo um Administrador nao pode fazer isso):
    // updateStageAndPosition nunca atualiza pipelineId, entao uma stage de
    // destino de outro pipeline deixaria o card com pipelineId e stageId
    // apontando para pipelines diferentes - ver achado adjacente ao I3.
    if (targetStage.pipelineId !== card.pipelineId) {
      throw new BadRequestException('Stage de destino nao pertence ao pipeline do card.');
    }

    const cardsInTargetStage = (
      await this.cardRepository.findAllByStage(input.targetStageId)
    ).filter((c) => c.id !== card.id);

    const newPosition = this.calculatePosition(cardsInTargetStage, input.targetIndex);

    const isRepique = targetStage.name === REPIQUE_STAGE_NAME;
    if (isRepique) {
      if (!input.motivoRepique || !isMotivoRepiqueValido(input.motivoRepique)) {
        throw new BadRequestException(
          `Motivo obrigatorio ao mover para Repique. Use um destes: ${MOTIVOS_REPIQUE.join(', ')}.`,
        );
      }
      await this.cardRepository.updateStageAndPosition(card.id, input.targetStageId, newPosition, {
        motivoRepique: input.motivoRepique,
        movidoParaRepiqueEm: new Date(),
      });
    } else {
      await this.cardRepository.updateStageAndPosition(card.id, input.targetStageId, newPosition);
    }

    // Fase B (revisao): card que estava na coluna "Atendimento VIVI" e foi
    // posto numa etapa pela gestao deixa a coluna (nao fica nos dois lugares).
    if (card.emAtendimentoVivi) {
      await this.cardRepository.sairDoAtendimentoVivi(card.id);
    }

    // Historico de etapas (BII): so quando a stage muda de verdade (reordenar
    // dentro da mesma coluna nao conta). emit (nao emitAsync): o Kanban nao
    // espera nem falha por causa de quem escuta.
    if (card.stageId !== input.targetStageId) {
      const evento: CardStageChangedEvent = {
        tenantId: input.tenantId,
        cardId: card.id,
        pipelineId: card.pipelineId,
        fromStageId: card.stageId ?? null,
        toStageId: input.targetStageId,
        userId: input.requesterUserId ?? null,
        origem: 'move',
        ocorridoEm: new Date(),
        motivoRepique: isRepique ? input.motivoRepique : null,
      };
      this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);
    }

    return { newPosition };
  }

  private calculatePosition(
    orderedSiblings: { position: number }[],
    targetIndex: number,
  ): number {
    if (orderedSiblings.length === 0) {
      return POSITION_STEP;
    }

    if (targetIndex === 0) {
      return orderedSiblings[0].position / 2;
    }

    if (targetIndex >= orderedSiblings.length) {
      return orderedSiblings[orderedSiblings.length - 1].position + POSITION_STEP;
    }

    return (orderedSiblings[targetIndex - 1].position + orderedSiblings[targetIndex].position) / 2;
  }
}
