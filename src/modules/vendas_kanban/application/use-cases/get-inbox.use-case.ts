// src/modules/vendas_kanban/application/use-cases/get-inbox.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';

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
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(input: GetInboxInput): Promise<CardRecord[]> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    const cards = await this.cardRepository.findAllByPipelineInbox(pipeline.id);

    // Indicador visual de "proxima atividade agendada" (InboxView) - uma
    // unica consulta em lote, mesmo padrao ja usado em GetBoardUseCase.
    const cardIds = cards.map((card) => card.id);
    const proximas = await this.activityRepository.findProximasByCardIds(cardIds);
    const proximaPorCard = new Map(proximas.map((p) => [p.cardId, p]));

    // Indicador visual de "rotting" (Fatia 2) - ultima atividade registrada
    // para calculo de dias sem atividade. Mesmo padrao que proximas.
    const ultimas = await this.activityRepository.findUltimasByCardIds(cardIds);
    const ultimaPorCard = new Map(
      ultimas.map((u) => [u.cardId, u.ultimaAtividadeEm.toISOString()]),
    );

    return cards.map((card) => ({
      ...card,
      proximaAtividade: proximaPorCard.get(card.id) ?? null,
      ultimaAtividadeEm: ultimaPorCard.get(card.id) ?? null,
    }));
  }
}
