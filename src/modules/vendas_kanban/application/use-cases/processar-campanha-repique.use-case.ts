// src/modules/vendas_kanban/application/use-cases/processar-campanha-repique.use-case.ts
// Corpo do job diario (ver infra/scheduler/repique-campanha.scheduler.ts):
// motor de campanha de remarketing escalonada - cards na stage "Repique"
// (sem opt-out) recebem mensagens automaticas a cada 2+ dias. A regra dos
// 2 dias e decidida AQUI (selecao de quando enviar); o "como" enviar
// (canal/template/registro) fica em RepiqueEnvioService, compartilhado
// com o disparo manual (DispararRepiqueManualUseCase) - ver PROGRESS.md.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IRepiqueCampanhaEnvioRepository } from '../../domain/repositories/repique-campanha-envio-repository.interface';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { RepiqueEnvioService } from '../services/repique-envio.service';

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProcessarCampanhaRepiqueUseCase {
  private readonly logger = new Logger(ProcessarCampanhaRepiqueUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IRepiqueCampanhaEnvioRepository')
    private readonly envioRepository: IRepiqueCampanhaEnvioRepository,
    @Inject('IWhatsAppSessionRepository')
    private readonly whatsAppSessionRepository: IWhatsAppSessionRepository,
    private readonly repiqueEnvioService: RepiqueEnvioService,
  ) {}

  async execute(): Promise<void> {
    const candidatos = await this.cardRepository.findElegiveisParaCampanhaRepique();
    if (candidatos.length === 0) {
      return;
    }

    // Uma unica consulta cross-tenant de sessoes conectadas (mesmo padrao
    // de ProcessRoletaTimeoutsUseCase) - montado em mapa para lookup O(1)
    // por tenant a cada card, sem repetir a consulta.
    const sessoesConectadas = await this.whatsAppSessionRepository.findAllConnected();
    const sessaoPorTenant = new Map(sessoesConectadas.map((sessao) => [sessao.tenantId, sessao]));

    for (const card of candidatos) {
      try {
        await this.processarCard(card, sessaoPorTenant.get(card.tenantId)?.id ?? null);
      } catch (err) {
        this.logger.error(
          `Erro processando campanha de repique do card ${card.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async processarCard(card: CardRecord, whatsappSessionId: string | null): Promise<void> {
    const ultimoEnvio = await this.envioRepository.findUltimoPorCard(card.id);
    if (ultimoEnvio) {
      const decorridoMs = Date.now() - ultimoEnvio.enviadoEm.getTime();
      if (decorridoMs < DOIS_DIAS_MS) {
        return; // ainda dentro da janela de 2 dias - nao envia agora (seja o ultimo envio manual ou automatico)
      }
    }

    await this.repiqueEnvioService.enviarProximo(card, whatsappSessionId);
  }
}
