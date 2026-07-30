// src/modules/vendas_kanban/application/use-cases/get-meu-dashboard.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository, ActivityRecord } from '../../domain/repositories/activity-repository.interface';

interface GetMeuDashboardInput {
  tenantId: string;
  requesterUserId: string;
}

const ULTIMOS_LEADS_LIMIT = 5;

export interface MeuDashboardResult {
  leadsPorEstagio: Array<{ stageId: string; stageName: string; count: number }>;
  atividadesHoje: ActivityRecord[];
  ultimosLeads: CardRecord[];
}

// Dashboard individual do Corretor (ou de qualquer dono de card, na
// pratica): sempre escopado ao proprio usuario logado (ownerId =
// requesterUserId), sem relacao com o RBAC por cargo hierarquico usado no
// Kanban/Atendimento (aquele resolve "quem mais eu vejo"; este e sempre
// "o que e meu"). Ver CLAUDE.md/PROGRESS.md, secao "Dashboard do Corretor".
@Injectable()
export class GetMeuDashboardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(input: GetMeuDashboardInput): Promise<MeuDashboardResult> {
    const [leadsPorEstagio, atividadesHoje, ultimosLeads] = await Promise.all([
      this.cardRepository.countByOwnerGroupedByStage(input.tenantId, input.requesterUserId),
      this.activityRepository.findPendingTodayByOwner(input.tenantId, input.requesterUserId),
      this.cardRepository.findRecentByOwner(
        input.tenantId,
        input.requesterUserId,
        ULTIMOS_LEADS_LIMIT,
      ),
    ]);

    // Indicador visual de "proxima atividade agendada" (Dashboard do Corretor) -
    // uma unica consulta em lote com todos os leads retornados, em vez de uma
    // query por card. Mesmo padrao ja usado em GetBoardUseCase.
    const allCardIds = ultimosLeads.map((card) => card.id);
    const proximas = await this.activityRepository.findProximasByCardIds(allCardIds);
    const proximaPorCard = new Map(proximas.map((p) => [p.cardId, p]));

    const ultimosLeadsComProxima = ultimosLeads.map((card) => ({
      ...card,
      proximaAtividade: proximaPorCard.get(card.id) ?? null,
    }));

    return {
      leadsPorEstagio: leadsPorEstagio.map(({ stageId, stageName, count }) => ({
        stageId,
        stageName,
        count,
      })),
      atividadesHoje,
      ultimosLeads: ultimosLeadsComProxima,
    };
  }
}
