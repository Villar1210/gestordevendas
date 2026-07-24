// src/modules/vendas_kanban/application/use-cases/get-board.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../../plantao/application/use-cases/get-corretores-escalados-hoje.use-case';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';

interface GetBoardInput {
  pipelineId: string;
  tenantId: string;
  // Quem esta pedindo o board - usado para restringir a visibilidade dos
  // cards conforme o escopo do cargo hierarquico (RBAC) - ver
  // shared/domain/services/cargo-escopo.ts.
  requesterRole: string;
  requesterUserId: string;
  requesterCargo: string | null;
  // Modulo Plantao/Stand: stand fixo do Coordenador, so relevante quando o
  // escopo resolvido for 'plantao'.
  requesterStandId: string | null;
}

export interface BoardStage {
  id: string;
  name: string;
  position: number;
  cards: CardRecord[];
}

export interface BoardResult {
  id: string;
  name: string;
  createdAt: Date;
  stages: BoardStage[];
}

@Injectable()
export class GetBoardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
    private readonly getCorretoresEscaladosHojeUseCase: GetCorretoresEscaladosHojeUseCase,
  ) {}

  async execute(input: GetBoardInput): Promise<BoardResult> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    const stages = await this.stageRepository.findAllByPipeline(pipeline.id);

    // Escopo por cargo hierarquico (RBAC): 'todos' (Administrador/Diretor)
    // -> sem filtro; 'equipe' (Gerente) -> proprios cards + cards de toda a
    // arvore de subordinados (recursivo); 'plantao' (Coordenador) -> cards
    // dos corretores ESCALADOS HOJE no stand fixo do Coordenador (sem
    // fallback se ele nao tiver standId - lista vazia); 'proprio'
    // (Corretor) -> so os proprios, mesmo comportamento de antes desta
    // fatia. A Caixa de Entrada (GetInboxUseCase) NAO aplica este filtro
    // de proposito - leads sem dono nao "pertencem" a equipe nenhuma
    // ainda, sao o pool de onde qualquer um reivindica um lead.
    const escopo = resolveEscopo(input.requesterRole, input.requesterCargo);

    let idsPermitidos: string[] | null = null; // null = sem filtro ('todos')
    if (escopo === 'proprio') {
      idsPermitidos = [input.requesterUserId];
    } else if (escopo === 'equipe') {
      const subordinados = await this.getSubordinadosRecursivosUseCase.execute({
        tenantId: input.tenantId,
        userId: input.requesterUserId,
      });
      idsPermitidos = [input.requesterUserId, ...subordinados];
    } else if (escopo === 'plantao') {
      idsPermitidos = await this.getCorretoresEscaladosHojeUseCase.execute({
        standId: input.requesterStandId,
      });
    }

    const stagesWithCards: BoardStage[] = await Promise.all(
      stages.map(async (stage) => {
        const cards = await this.cardRepository.findAllByStage(stage.id);
        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          cards: idsPermitidos
            ? cards.filter((card) => card.ownerId && idsPermitidos!.includes(card.ownerId))
            : cards,
        };
      }),
    );

    // Indicador visual de "proxima atividade agendada" (KanbanCard) - uma
    // unica consulta em lote com todos os cards realmente retornados (ja
    // filtrados pelo escopo RBAC acima), em vez de uma query por card.
    const allCardIds = stagesWithCards.flatMap((stage) => stage.cards.map((card) => card.id));
    const proximas = await this.activityRepository.findProximasByCardIds(allCardIds);
    const proximaPorCard = new Map(proximas.map((p) => [p.cardId, p]));

    const stagesComProximaAtividade: BoardStage[] = stagesWithCards.map((stage) => ({
      ...stage,
      cards: stage.cards.map((card) => ({
        ...card,
        proximaAtividade: proximaPorCard.get(card.id) ?? null,
      })),
    }));

    return {
      id: pipeline.id,
      name: pipeline.name,
      createdAt: pipeline.createdAt,
      stages: stagesComProximaAtividade,
    };
  }
}
