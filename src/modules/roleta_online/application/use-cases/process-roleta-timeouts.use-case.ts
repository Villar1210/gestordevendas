// src/modules/roleta_online/application/use-cases/process-roleta-timeouts.use-case.ts
// Corpo do job agendado (ver infra/scheduler/roleta-timeout.scheduler.ts):
// verifica TODOS os cards com atribuicao automatica pendente de aceite, de
// qualquer tenant, e reatribui os que ja passaram do timeout configurado
// para o proximo corretor da fila (mesmo criterio de escolha do modo
// automatico normal - ver domain/services/pick-corretor.ts).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IRoletaConfigRepository } from '../../domain/repositories/roleta-config-repository.interface';
import { ICorretorRepository, CorretorRecord } from '../../../rh/domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../../rh/domain/repositories/role-repository.interface';
import { ICardRepository, CardRecord } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { pickByRoundRobin, pickByMenorFila } from '../../domain/services/pick-corretor';
import { comTravaPorTenant } from '../../domain/services/trava-por-tenant';
import { FilaRoletaService } from '../services/fila-roleta.service';

const CORRETOR_ROLE_NAME = 'Corretor';
const STAGE_TERMINAL_NAME = 'Fechamento';

@Injectable()
export class ProcessRoletaTimeoutsUseCase {
  private readonly logger = new Logger(ProcessRoletaTimeoutsUseCase.name);

  constructor(
    @Inject('IRoletaConfigRepository')
    private readonly roletaConfigRepository: IRoletaConfigRepository,
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
    @Inject('IRoleRepository') private readonly roleRepository: IRoleRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly filaRoletaService: FilaRoletaService,
  ) {}

  async execute(): Promise<void> {
    const pendentes = await this.cardRepository.findPendentesDeAceite();
    if (pendentes.length === 0) {
      return;
    }

    for (const card of pendentes) {
      try {
        // Mesma trava da DistributeLeadUseCase: a reatribuicao tambem le e
        // grava o ultimo corretor do tenant.
        await comTravaPorTenant(card.tenantId, () => this.processarCard(card));
      } catch (err) {
        // Um card com problema (ex: config/role removida entre o momento
        // da atribuicao e a checagem) nao pode travar os demais - mesmo
        // padrao de listener resiliente ja usado em
        // CardSemDonoCriadoListener.
        this.logger.error(`Erro processando timeout do card ${card.id}: ${(err as Error).message}`);
      }
    }
  }

  private async processarCard(card: CardRecord): Promise<void> {
    const config = await this.roletaConfigRepository.findByTenant(card.tenantId);
    if (!config) {
      return;
    }

    const limiteMs = config.timeoutAceiteMinutos * 60_000;
    const decorridoMs = Date.now() - card.atribuidoAutomaticamenteEm!.getTime();
    if (decorridoMs < limiteMs) {
      return; // ainda dentro do prazo
    }

    // Fatia 2 (Sorteio da vez): proximo da fila sorteada, excluindo quem
    // perdeu o prazo (que ja tinha ido para o fim da fila ao receber).
    if (config.algoritmo === 'sorteio') {
      const escolha = await this.filaRoletaService.escolherParaLead(
        card.tenantId,
        card.id,
        card.ownerId ? [card.ownerId] : [],
      );
      if (!escolha) {
        await this.cardRepository.clearAtribuidoAutomaticamente(card.id);
        this.logger.warn(
          `Timeout do card ${card.id} vencido, mas nao ha outro corretor presente na roleta - mantido com o dono atual.`,
        );
        return;
      }
      await this.cardRepository.reassignOwnerAfterTimeout(card.id, escolha.userId, new Date());
      this.logger.log(`Card ${card.id} reatribuido de ${card.ownerId} para ${escolha.userId} (sorteio da vez) apos timeout.`);
      this.eventEmitter.emit('lead.atribuido', { tenantId: card.tenantId, cardId: card.id, ownerId: escolha.userId });
      return;
    }

    const corretorRole = await this.roleRepository.findByTenantAndName(card.tenantId, CORRETOR_ROLE_NAME);
    if (!corretorRole) {
      return;
    }

    const onlineCorretores = await this.corretorRepository.findOnlineByTenantAndRole(
      card.tenantId,
      corretorRole.id,
    );
    // Exclui quem perdeu o prazo - "reatribui para o PROXIMO da fila", nao
    // para a mesma pessoa de novo.
    const candidatos = onlineCorretores.filter((corretor) => corretor.id !== card.ownerId);

    if (candidatos.length === 0) {
      // Ninguem mais online para reatribuir - fica com o dono atual, sem
      // repetir a checagem indefinidamente (nem re-notificar a cada minuto).
      await this.cardRepository.clearAtribuidoAutomaticamente(card.id);
      this.logger.warn(
        `Timeout do card ${card.id} vencido, mas nao ha outro corretor online - mantido com o dono atual.`,
      );
      return;
    }

    let novoDono: CorretorRecord;
    if (config.algoritmo === 'menor_fila') {
      novoDono = await this.escolherPorMenorFila(candidatos, card.tenantId, card.pipelineId);
    } else {
      novoDono = pickByRoundRobin(candidatos, config.ultimoCorretorId);
      await this.roletaConfigRepository.updateUltimoCorretor(card.tenantId, novoDono.id);
    }

    await this.cardRepository.reassignOwnerAfterTimeout(card.id, novoDono.id, new Date());
    this.logger.log(
      `Card ${card.id} reatribuido de ${card.ownerId} para ${novoDono.id} apos timeout de aceite.`,
    );

    this.eventEmitter.emit('lead.atribuido', {
      tenantId: card.tenantId,
      cardId: card.id,
      ownerId: novoDono.id,
    });
  }

  private async escolherPorMenorFila(
    onlineCorretores: CorretorRecord[],
    tenantId: string,
    pipelineId: string,
  ): Promise<CorretorRecord> {
    const stages = await this.stageRepository.findAllByPipeline(pipelineId);
    const activeStageIds = stages
      .filter((stage) => stage.name !== STAGE_TERMINAL_NAME)
      .map((stage) => stage.id);

    const withCounts = await Promise.all(
      onlineCorretores.map(async (corretor) => ({
        corretor,
        count: await this.cardRepository.countActiveByOwnerInStages({
          tenantId,
          ownerId: corretor.id,
          stageIds: activeStageIds,
        }),
      })),
    );

    return pickByMenorFila(withCounts);
  }
}
