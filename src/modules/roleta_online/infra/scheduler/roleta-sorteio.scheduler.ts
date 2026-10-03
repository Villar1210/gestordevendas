// src/modules/roleta_online/infra/scheduler/roleta-sorteio.scheduler.ts
// Fatia 2 (Sorteio da vez). Mesmo padrao do RoletaTimeoutScheduler: 1 em 1
// minuto, guarda isRunning, processo unico no pm2 (sem cluster).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcessarHorariosSorteioUseCase } from '../../application/use-cases/processar-horarios-sorteio.use-case';

@Injectable()
export class RoletaSorteioScheduler {
  private readonly logger = new Logger(RoletaSorteioScheduler.name);
  private isRunning = false;

  constructor(private readonly processarHorariosSorteioUseCase: ProcessarHorariosSorteioUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.processarHorariosSorteioUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job de sorteio das roletas: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
