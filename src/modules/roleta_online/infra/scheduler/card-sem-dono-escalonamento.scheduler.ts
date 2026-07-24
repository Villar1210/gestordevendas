// src/modules/roleta_online/infra/scheduler/card-sem-dono-escalonamento.scheduler.ts
// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo). Roda a cada 5 minutos - mesmo padrao de guarda isRunning ja
// usado por RoletaTimeoutScheduler (processo unico via pm2, sem cluster,
// nao precisa de lock distribuido).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalonarCardsSemDonoUseCase } from '../../application/use-cases/escalonar-cards-sem-dono.use-case';

@Injectable()
export class CardSemDonoEscalonamentoScheduler {
  private readonly logger = new Logger(CardSemDonoEscalonamentoScheduler.name);
  private isRunning = false;

  constructor(private readonly escalonarCardsSemDonoUseCase: EscalonarCardsSemDonoUseCase) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleEscalonamento(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.escalonarCardsSemDonoUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job de escalonamento de cards sem dono: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
