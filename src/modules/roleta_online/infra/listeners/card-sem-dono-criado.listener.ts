// src/modules/roleta_online/infra/listeners/card-sem-dono-criado.listener.ts
// Escuta o evento generico emitido pelo CreateQuickCardUseCase (modulo
// vendas_kanban). Nao ha import direto entre os dois modulos alem dos
// providers explicitamente exportados - o unico contrato adicional e o
// nome do evento e o formato do payload, por convencao (mesmo padrao do
// listener da VIVI). Ver CLAUDE.md "Decisao tecnica: Organizacao de pastas
// por modulo".
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DistributeLeadUseCase } from '../../application/use-cases/distribute-lead.use-case';

interface CardSemDonoCriadoEvent {
  tenantId: string;
  cardId: string;
  pipelineId: string;
}

@Injectable()
export class CardSemDonoCriadoListener {
  private readonly logger = new Logger(CardSemDonoCriadoListener.name);

  constructor(private readonly distributeLeadUseCase: DistributeLeadUseCase) {}

  @OnEvent('card.sem_dono.criado')
  async handle(event: CardSemDonoCriadoEvent): Promise<void> {
    try {
      await this.distributeLeadUseCase.execute(event);
    } catch (error) {
      // Nunca deixa uma falha na Roleta Online derrubar a criacao do card -
      // so registra o erro. O lead continua normalmente na Caixa de Entrada.
      this.logger.error(
        `Falha ao distribuir o lead (card ${event.cardId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
