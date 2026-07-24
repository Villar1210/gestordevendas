// src/modules/atendimento/infra/scheduler/atendimento-sem-dono-escalonamento.scheduler.ts
// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo), caminho da Fila. Roda a cada 5 minutos - mesmo padrao de guarda
// isRunning ja usado por RoletaTimeoutScheduler/CardSemDonoEscalonamentoScheduler
// (processo unico via pm2, sem cluster, nao precisa de lock distribuido).
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalonarAtendimentosSemDonoUseCase } from '../../application/use-cases/escalonar-atendimentos-sem-dono.use-case';

@Injectable()
export class AtendimentoSemDonoEscalonamentoScheduler {
  private readonly logger = new Logger(AtendimentoSemDonoEscalonamentoScheduler.name);
  private isRunning = false;

  constructor(
    private readonly escalonarAtendimentosSemDonoUseCase: EscalonarAtendimentosSemDonoUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleEscalonamento(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.escalonarAtendimentosSemDonoUseCase.execute();
    } catch (err) {
      this.logger.error(`Erro no job de escalonamento de atendimentos sem dono: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
