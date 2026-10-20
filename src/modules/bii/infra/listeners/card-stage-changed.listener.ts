// src/modules/bii/infra/listeners/card-stage-changed.listener.ts
// Escuta 'card.stage.changed' (emitido pelo vendas_kanban com emit, depois da
// escrita) e grava BiiCardStageEvento com o NOME das etapas no momento
// (buscado por id + tenantId). Nunca lanca: qualquer falha so vira log (sem
// dado pessoal - so ids e a mensagem do erro) e o Kanban segue normal.
// Limitacao conhecida: evento em memoria - se o processo cair entre a escrita
// do card e este listener, o evento se perde (janela de milissegundos).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CARD_STAGE_CHANGED_EVENT, CardStageChangedEvent } from '../../domain/events/card-stage-changed.event';
import { ICardStageEventoRepository } from '../../domain/repositories/card-stage-evento-repository.interface';

@Injectable()
export class CardStageChangedListener {
  private readonly logger = new Logger(CardStageChangedListener.name);

  constructor(
    @Inject('ICardStageEventoRepository') private readonly repository: ICardStageEventoRepository,
  ) {}

  @OnEvent(CARD_STAGE_CHANGED_EVENT)
  async handle(event: CardStageChangedEvent): Promise<void> {
    try {
      if (!event?.tenantId || !event.cardId || !event.toStageId) {
        this.logger.warn('Evento card.stage.changed incompleto ignorado.');
        return;
      }
      if (!(await this.repository.cardPertenceAoTenant(event.tenantId, event.cardId))) {
        this.logger.warn(`Evento ignorado: card ${event.cardId} nao pertence ao tenant ${event.tenantId}.`);
        return;
      }
      const ids = [event.toStageId, ...(event.fromStageId ? [event.fromStageId] : [])];
      const nomes = await this.repository.buscarNomesEtapas(event.tenantId, ids);
      const toStageNome = nomes.get(event.toStageId);
      if (!toStageNome) {
        this.logger.warn(`Evento ignorado: stage ${event.toStageId} nao encontrada no tenant ${event.tenantId}.`);
        return;
      }
      await this.repository.registrar({
        tenantId: event.tenantId,
        cardId: event.cardId,
        pipelineId: event.pipelineId ?? null,
        fromStageId: event.fromStageId ?? null,
        toStageId: event.toStageId,
        fromStageNome: event.fromStageId ? (nomes.get(event.fromStageId) ?? null) : null,
        toStageNome,
        userId: event.userId ?? null,
        origem: event.origem,
        motivoRepique: event.motivoRepique ?? null,
        ocorridoEm: event.ocorridoEm instanceof Date ? event.ocorridoEm : new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Falha ao gravar historico de etapa (card ${event?.cardId}): ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }
  }
}
