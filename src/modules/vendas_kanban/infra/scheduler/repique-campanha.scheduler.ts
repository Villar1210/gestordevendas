// src/modules/vendas_kanban/infra/scheduler/repique-campanha.scheduler.ts
// Terceiro job agendado do projeto (ver ScheduleModule.forRoot() em
// app.module.ts) - mesmo padrao ja usado em roleta-timeout.scheduler.ts e
// repique-inatividade.scheduler.ts (guarda isRunning evita sobreposicao;
// deploy roda em processo unico via pm2, sem cluster). Roda as 9h (nao as
// 3h como o job de deteccao de inatividade) - esse aqui manda mensagem de
// verdade para o lead, horario comercial e mais adequado.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcessarCampanhaRepiqueUseCase } from '../../application/use-cases/processar-campanha-repique.use-case';

@Injectable()
export class RepiqueCampanhaScheduler {
  private readonly logger = new Logger(RepiqueCampanhaScheduler.name);
  private isRunning = false;

  constructor(private readonly processarCampanhaRepiqueUseCase: ProcessarCampanhaRepiqueUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleCampanha(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.processarCampanhaRepiqueUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job diario de campanha do Repique: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
