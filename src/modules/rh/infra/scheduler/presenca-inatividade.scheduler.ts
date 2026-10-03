// src/modules/rh/infra/scheduler/presenca-inatividade.scheduler.ts
// Presenca automatica (Fatia 1 - Atendimento/Roleta). Mesmo padrao do
// RoletaTimeoutScheduler: roda de 1 em 1 minuto, com guarda isRunning contra
// sobreposicao (processo unico no pm2, sem cluster).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarcarInativosOfflineUseCase } from '../../application/use-cases/marcar-inativos-offline.use-case';

@Injectable()
export class PresencaInatividadeScheduler {
  private readonly logger = new Logger(PresencaInatividadeScheduler.name);
  private isRunning = false;

  constructor(private readonly marcarInativosOfflineUseCase: MarcarInativosOfflineUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.marcarInativosOfflineUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job de presenca automatica: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
