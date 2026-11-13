// src/modules/campanhas_sms/infra/scheduler/envio-campanha.scheduler.ts
// Job de envio: uma rodada a cada 15 s (nunca duas ao mesmo tempo). No boot,
// contatos presos em "enviando" viram "falhou" (sem reenvio automatico).
// Uma instancia so no PM2 (como o resto dos jobs do projeto).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ProcessadorEnvioService } from '../../application/services/processador-envio.service';

@Injectable()
export class EnvioCampanhaScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnvioCampanhaScheduler.name);
  private rodando = false;
  private readonly sinal = { abortado: false };

  constructor(private readonly processador: ProcessadorEnvioService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.processador.recuperarTravados();
    } catch (e) {
      this.logger.error(`Falha ao recuperar envios interrompidos: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    this.sinal.abortado = true;
  }

  @Interval('campanhas-sms-envio', 15_000)
  async tick(): Promise<void> {
    if (this.rodando || this.sinal.abortado) return;
    this.rodando = true;
    try {
      const r = await this.processador.rodar(this.sinal);
      if (r.enviados || r.falhas || r.adiados || r.concluidas) {
        this.logger.log(`Rodada SMS: enviados=${r.enviados} falhas=${r.falhas} adiados=${r.adiados} bloqueados=${r.bloqueados} concluidas=${r.concluidas}`);
      }
    } catch (e) {
      this.logger.error(`Falha na rodada de envio de SMS: ${(e as Error).message}`);
    } finally {
      this.rodando = false;
    }
  }
}
