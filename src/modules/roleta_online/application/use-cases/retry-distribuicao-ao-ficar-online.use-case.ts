// src/modules/roleta_online/application/use-cases/retry-distribuicao-ao-ficar-online.use-case.ts
// Rede de seguranca "sem corretor online" (Camada 1 - retry): disparado
// quando um corretor muda o proprio status para "online" (ver
// UpdateStatusDisponibilidadeUseCase, modulo rh, evento
// 'corretor.ficou_online'). Busca TODOS os cards sem stage e sem dono do
// tenant (nao so os do pipeline mais recente) e tenta distribuir cada um de
// novo via DistributeLeadUseCase - que ja e seguro chamar mesmo sem
// nenhuma mudanca real (config inativa ou ninguem online = no-op).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { DistributeLeadUseCase } from './distribute-lead.use-case';

interface RetryDistribuicaoInput {
  tenantId: string;
}

@Injectable()
export class RetryDistribuicaoAoFicarOnlineUseCase {
  private readonly logger = new Logger(RetryDistribuicaoAoFicarOnlineUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly distributeLeadUseCase: DistributeLeadUseCase,
  ) {}

  async execute(input: RetryDistribuicaoInput): Promise<void> {
    const pendentes = await this.cardRepository.findAllInboxByTenant(input.tenantId);
    if (pendentes.length === 0) {
      return;
    }

    for (const card of pendentes) {
      try {
        await this.distributeLeadUseCase.execute({
          tenantId: card.tenantId,
          cardId: card.id,
          pipelineId: card.pipelineId,
        });
      } catch (err) {
        // Um card com problema nao pode travar os demais - mesmo padrao
        // resiliente ja usado em ProcessRoletaTimeoutsUseCase.
        this.logger.error(`Erro tentando redistribuir o card ${card.id}: ${(err as Error).message}`);
      }
    }
  }
}
