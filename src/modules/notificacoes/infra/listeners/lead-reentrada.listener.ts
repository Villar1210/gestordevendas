// src/modules/notificacoes/infra/listeners/lead-reentrada.listener.ts
// Fase B (27/10/2026): cliente que ja tem card aberto entrou de novo (site,
// WhatsApp, rede social, cadastro rapido) - CreateQuickCardUseCase NAO cria
// card novo e emite 'lead.reentrada'. Aqui o corretor dono recebe o aviso no
// sino. Contrato so por nome de evento + formato (mesmo padrao do
// LeadAtribuidoListener), sem importar o vendas_kanban alem do repositorio
// ja exportado.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

interface LeadReentradaEvent {
  tenantId: string;
  cardId: string;
  ownerId: string;
  origem: string;
}

@Injectable()
export class LeadReentradaListener {
  private readonly logger = new Logger(LeadReentradaListener.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('lead.reentrada')
  async handle(event: LeadReentradaEvent): Promise<void> {
    try {
      const card = await this.cardRepository.findByIdAndTenant(event.cardId, event.tenantId);
      if (!card) return;
      await this.createNotificationUseCase.execute({
        tenantId: event.tenantId,
        userId: event.ownerId,
        tipo: 'lead_reentrada',
        mensagem: `Seu cliente ${card.title} entrou em contato de novo.`,
        link: `/dashboard/kanban?pipelineId=${card.pipelineId}&cardId=${card.id}`,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao avisar o corretor sobre novo contato (card ${event.cardId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
