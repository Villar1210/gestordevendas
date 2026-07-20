// src/modules/vendas_kanban/infra/scheduler/repique-inatividade.scheduler.ts
// Segundo job agendado do projeto (ver ScheduleModule.forRoot() em
// app.module.ts) - mesmo padrao ja usado em
// roleta_online/infra/scheduler/roleta-timeout.scheduler.ts (guarda
// isRunning evita sobreposicao; deploy roda em processo unico via pm2,
// sem cluster, entao nao precisa de lock distribuido). Roda 1x por dia
// (nao precisa da granularidade de 1 minuto do timeout da Roleta).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MoverLeadsInativosParaRepiqueUseCase } from '../../application/use-cases/mover-leads-inativos-para-repique.use-case';

@Injectable()
export class RepiqueInatividadeScheduler {
  private readonly logger = new Logger(RepiqueInatividadeScheduler.name);
  private isRunning = false;

  constructor(private readonly moverLeadsInativosParaRepiqueUseCase: MoverLeadsInativosParaRepiqueUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleInatividade(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.moverLeadsInativosParaRepiqueUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job diario de inatividade do Repique: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
