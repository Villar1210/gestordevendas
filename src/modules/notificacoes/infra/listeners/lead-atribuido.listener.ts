// src/modules/notificacoes/infra/listeners/lead-atribuido.listener.ts
// Escuta o evento generico emitido por DistributeLeadUseCase (modo
// automatico) e ConfirmSuggestedOwnerUseCase (modo semi_automatico, ao
// confirmar) - modulo roleta_online. Nao ha import direto entre os dois
// modulos alem dos providers explicitamente exportados - o unico contrato
// adicional e o nome do evento e o formato do payload, por convencao
// (mesmo padrao ja usado por CardSemDonoCriadoListener/
// CadastroPendenteCriadoListener). Ver CLAUDE.md "Decisao tecnica:
// Organizacao de pastas por modulo".
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

interface LeadAtribuidoEvent {
  tenantId: string;
  cardId: string;
  ownerId: string;
}

@Injectable()
export class LeadAtribuidoListener {
  private readonly logger = new Logger(LeadAtribuidoListener.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('lead.atribuido')
  async handle(event: LeadAtribuidoEvent): Promise<void> {
    try {
      const card = await this.cardRepository.findByIdAndTenant(event.cardId, event.tenantId);
      // O evento so e emitido logo apos ClaimCardUseCase (que sempre grava
      // stageId junto com ownerId) - card/stageId nulos aqui indicariam
      // algo removido/alterado entre o emit e o handle, nao um estado
      // esperado. So loga e desiste, sem quebrar nada.
      if (!card || !card.stageId) {
        this.logger.warn(`Lead atribuido (card ${event.cardId}) sem stage - notificacao ignorada.`);
        return;
      }

      const stage = await this.stageRepository.findByIdAndTenant(card.stageId, event.tenantId);

      await this.createNotificationUseCase.execute({
        tenantId: event.tenantId,
        userId: event.ownerId,
        tipo: 'lead_atribuido',
        mensagem: `Novo lead atribuído: ${card.title} (${stage?.name ?? 'Em Atendimento'})`,
        link: `/dashboard/kanban?pipelineId=${card.pipelineId}&cardId=${card.id}`,
      });
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar a atribuicao do lead -
      // so registra o erro (mesmo padrao ja usado em CardSemDonoCriadoListener).
      this.logger.error(
        `Falha ao notificar corretor sobre lead atribuido (card ${event.cardId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
