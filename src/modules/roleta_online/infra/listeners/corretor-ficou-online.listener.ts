// src/modules/roleta_online/infra/listeners/corretor-ficou-online.listener.ts
// Escuta o evento generico emitido por UpdateStatusDisponibilidadeUseCase
// (modulo rh) quando um corretor muda o proprio status para "online" - sem
// import direto entre os dois modulos alem do contrato de nome do
// evento/formato do payload, por convencao (mesmo padrao de
// CardSemDonoCriadoListener). Rede de seguranca "sem corretor online"
// (Camada 1 - retry, ver CLAUDE.md).
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RetryDistribuicaoAoFicarOnlineUseCase } from '../../application/use-cases/retry-distribuicao-ao-ficar-online.use-case';

interface CorretorFicouOnlineEvent {
  tenantId: string;
  userId: string;
}

@Injectable()
export class CorretorFicouOnlineListener {
  private readonly logger = new Logger(CorretorFicouOnlineListener.name);

  constructor(
    private readonly retryDistribuicaoAoFicarOnlineUseCase: RetryDistribuicaoAoFicarOnlineUseCase,
  ) {}

  @OnEvent('corretor.ficou_online')
  async handle(event: CorretorFicouOnlineEvent): Promise<void> {
    try {
      await this.retryDistribuicaoAoFicarOnlineUseCase.execute({ tenantId: event.tenantId });
    } catch (error) {
      // Nunca deixa uma falha aqui derrubar a troca de status do corretor -
      // so registra o erro. Mesmo padrao de CardSemDonoCriadoListener.
      this.logger.error(
        `Falha ao tentar redistribuir leads pendentes (tenant ${event.tenantId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
