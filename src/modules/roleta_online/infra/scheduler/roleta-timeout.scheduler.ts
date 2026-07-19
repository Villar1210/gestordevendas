// src/modules/roleta_online/infra/scheduler/roleta-timeout.scheduler.ts
// Unico job agendado do projeto ate hoje - ver ScheduleModule.forRoot() em
// app.module.ts. Guarda isRunning evita sobreposicao caso uma execucao
// demore mais que 1 minuto (deploy roda em processo unico via pm2, sem
// cluster - nao precisa de lock distribuido).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcessRoletaTimeoutsUseCase } from '../../application/use-cases/process-roleta-timeouts.use-case';

@Injectable()
export class RoletaTimeoutScheduler {
  private readonly logger = new Logger(RoletaTimeoutScheduler.name);
  private isRunning = false;

  constructor(private readonly processRoletaTimeoutsUseCase: ProcessRoletaTimeoutsUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimeouts(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.processRoletaTimeoutsUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job de timeout da Roleta Online: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
