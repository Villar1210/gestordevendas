// src/modules/vendas_kanban/application/use-cases/get-inbox.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

interface GetInboxInput {
  tenantId: string;
  pipelineId: string;
  // requesterRole/requesterCargo NAO sao usados para filtrar os cards em si:
  // a Caixa de Entrada mostra todos os cards sem dono para qualquer role,
  // Corretor incluido - e assim que o corretor "reivindica" um lead (ver
  // ClaimCardUseCase e a nota sobre Caixa de Entrada no CLAUDE.md). Sao
  // usados so para a restricao de PIPELINE do funil de remarketing abaixo -
  // mesma checagem ja aplicada em GetBoardUseCase/ClaimCardUseCase.
  requesterRole: string;
  requesterUserId: string;
  requesterCargo: string | null;
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

    // Restricao de visibilidade do funil de remarketing (ver
    // domain/services/remarketing-pipeline.ts) - mesma checagem ja aplicada
    // em GetBoardUseCase/ClaimCardUseCase, aqui reforcada contra acesso
    // direto a Caixa de Entrada deste pipeline por quem nao deveria.
    if (
      pipeline.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
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
