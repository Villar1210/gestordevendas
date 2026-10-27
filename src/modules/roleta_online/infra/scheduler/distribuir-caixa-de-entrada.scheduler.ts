// src/modules/roleta_online/infra/scheduler/distribuir-caixa-de-entrada.scheduler.ts
// Fase B (27/10/2026): as 9h (Sao Paulo, independente do fuso do servidor)
// distribui os leads que chegaram fora do horario e ficaram na Caixa de
// Entrada. Reaproveita o mesmo caminho de "corretor ficou online"
// (RetryDistribuicaoAoFicarOnlineUseCase), tenant por tenant.
// Obs.: na Roleta por sorteio, quem ainda nao estiver na fila as 9h nao
// recebe; a nova tentativa acontece quando um corretor fica online.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IRoletaConfigRepository } from '../../domain/repositories/roleta-config-repository.interface';
import { RetryDistribuicaoAoFicarOnlineUseCase } from '../../application/use-cases/retry-distribuicao-ao-ficar-online.use-case';
import { FUSO_ATENDIMENTO, HORA_ABERTURA } from '../../domain/services/horario-atendimento';

@Injectable()
export class DistribuirCaixaDeEntradaScheduler {
  private readonly logger = new Logger(DistribuirCaixaDeEntradaScheduler.name);

  constructor(
    @Inject('IRoletaConfigRepository') private readonly roletaConfigRepository: IRoletaConfigRepository,
    private readonly retryDistribuicao: RetryDistribuicaoAoFicarOnlineUseCase,
  ) {}

  // 1 minuto depois da abertura, para o relogio nao cair em 8:59:59.
  @Cron(`1 ${HORA_ABERTURA} * * *`, { timeZone: FUSO_ATENDIMENTO })
  async distribuirNaAbertura(): Promise<void> {
    try {
      const tenants = await this.roletaConfigRepository.findTenantsComRoletaAtiva();
      for (const tenantId of tenants) {
        try {
          await this.retryDistribuicao.execute({ tenantId });
        } catch (err) {
          this.logger.error(`Distribuicao das 9h falhou no tenant ${tenantId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Distribuicao das 9h falhou: ${(err as Error).message}`);
    }
  }
}
