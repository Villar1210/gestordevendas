// src/modules/vendas_kanban/infra/scheduler/atendimento-vivi-parado.scheduler.ts
// Fase B (27/10/2026): de hora em hora, leads da coluna "Atendimento VIVI"
// sem interacao ha 7 dias vao para o Repique (motivo SEM_RESPOSTA_VIVI).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MoverAtendimentoViviParadoParaRepiqueUseCase } from '../../application/use-cases/atendimento-vivi-gestao.use-cases';

@Injectable()
export class AtendimentoViviParadoScheduler {
  private readonly logger = new Logger(AtendimentoViviParadoScheduler.name);
  private isRunning = false;

  constructor(private readonly moverParados: MoverAtendimentoViviParadoParaRepiqueUseCase) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const movidos = await this.moverParados.execute();
      if (movidos > 0) this.logger.log(`${movidos} lead(s) da VIVI sem resposta ha 7 dias foram para o Repique.`);
    } catch (err) {
      this.logger.error(`Erro no job de Atendimento VIVI parado: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
