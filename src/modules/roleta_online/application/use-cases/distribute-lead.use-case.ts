// src/modules/roleta_online/application/use-cases/distribute-lead.use-case.ts
// Nucleo da Roleta Online: escolhe um corretor online para um card sem dono
// e, dependendo do modo configurado, ou atribui de vez (automatico) ou so
// sugere (semi_automatico, aguardando confirmacao). Se a Roleta estiver
// inativa ou nao houver ninguem online, nao faz nada - o lead fica na
// Caixa de Entrada normal, do jeito que ja funciona hoje.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IRoletaConfigRepository } from '../../domain/repositories/roleta-config-repository.interface';
import { ICorretorRepository, CorretorRecord } from '../../../rh/domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../../rh/domain/repositories/role-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { ClaimCardUseCase } from '../../../vendas_kanban/application/use-cases/claim-card.use-case';
import { pickByRoundRobin, pickByMenorFila } from '../../domain/services/pick-corretor';

const CORRETOR_ROLE_NAME = 'Corretor';
// Stage terminal do pipeline padrao - cards nela nao contam como "fila
// ativa" para o algoritmo menor_fila (negocio ja fechado).
const STAGE_TERMINAL_NAME = 'Fechamento';

interface DistributeLeadInput {
  tenantId: string;
  cardId: string;
  pipelineId: string;
}

@Injectable()
export class DistributeLeadUseCase {
  private readonly logger = new Logger(DistributeLeadUseCase.name);

  constructor(
    @Inject('IRoletaConfigRepository')
    private readonly roletaConfigRepository: IRoletaConfigRepository,
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
    @Inject('IRoleRepository') private readonly roleRepository: IRoleRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    private readonly claimCardUseCase: ClaimCardUseCase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: DistributeLeadInput): Promise<void> {
    const config = await this.roletaConfigRepository.findByTenant(input.tenantId);
    if (!config || !config.ativa) {
      return;
    }

    const corretorRole = await this.roleRepository.findByTenantAndName(
      input.tenantId,
      CORRETOR_ROLE_NAME,
    );
    if (!corretorRole) {
      return;
    }

    const onlineCorretores = await this.corretorRepository.findOnlineByTenantAndRole(
      input.tenantId,
      corretorRole.id,
    );
    if (onlineCorretores.length === 0) {
      return;
    }

    let chosen: CorretorRecord;
    if (config.algoritmo === 'menor_fila') {
      chosen = await this.escolherPorMenorFila(onlineCorretores, input.tenantId, input.pipelineId);
    } else {
      chosen = pickByRoundRobin(onlineCorretores, config.ultimoCorretorId);
      await this.roletaConfigRepository.updateUltimoCorretor(input.tenantId, chosen.id);
    }

    if (config.modo === 'automatico') {
      await this.claimCardUseCase.execute({
        cardId: input.cardId,
        tenantId: input.tenantId,
        userId: chosen.id,
      });
      // Marca o momento da atribuicao automatica - inicia a janela de
      // timeout de aceite (ver ProcessRoletaTimeoutsUseCase). Card so
      // vira dono "definitivo" quando o proprio corretor clicar em
      // "Aceitar Lead" (AceitarLeadUseCase) ou, se ninguem aceitar a
      // tempo, e reatribuido ao proximo da fila.
      await this.cardRepository.markAtribuidoAutomaticamente(input.cardId, new Date());
      this.logger.log(`Lead ${input.cardId} atribuido automaticamente a ${chosen.id} (aguardando aceite).`);
      // Notifica o corretor que recebeu o lead (modulo notificacoes, ver
      // LeadAtribuidoListener) - emit() nao aguarda o listener, mesmo
      // padrao ja usado por CreateQuickCardUseCase para 'card.sem_dono.criado'.
      this.eventEmitter.emit('lead.atribuido', {
        tenantId: input.tenantId,
        cardId: input.cardId,
        ownerId: chosen.id,
      });
    } else {
      await this.cardRepository.updateSuggestedOwner(input.cardId, chosen.id);
      this.logger.log(`Lead ${input.cardId} sugerido para ${chosen.id} (aguardando confirmacao).`);
    }
  }

  // Busca as contagens de fila (depende de repositorio) e delega a escolha
  // em si para a funcao pura pickByMenorFila (domain/services/pick-corretor.ts).
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
