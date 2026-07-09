// src/modules/roleta_online/application/use-cases/distribute-lead.use-case.ts
// Nucleo da Roleta Online: escolhe um corretor online para um card sem dono
// e, dependendo do modo configurado, ou atribui de vez (automatico) ou so
// sugere (semi_automatico, aguardando confirmacao). Se a Roleta estiver
// inativa ou nao houver ninguem online, nao faz nada - o lead fica na
// Caixa de Entrada normal, do jeito que ja funciona hoje.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IRoletaConfigRepository } from '../../domain/repositories/roleta-config-repository.interface';
import { ICorretorRepository, CorretorRecord } from '../../../rh/domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../../rh/domain/repositories/role-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { ClaimCardUseCase } from '../../../vendas_kanban/application/use-cases/claim-card.use-case';

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
      chosen = await this.pickByMenorFila(onlineCorretores, input.tenantId, input.pipelineId);
    } else {
      chosen = this.pickByRoundRobin(onlineCorretores, config.ultimoCorretorId);
      await this.roletaConfigRepository.updateUltimoCorretor(input.tenantId, chosen.id);
    }

    if (config.modo === 'automatico') {
      await this.claimCardUseCase.execute({
        cardId: input.cardId,
        tenantId: input.tenantId,
        userId: chosen.id,
      });
      this.logger.log(`Lead ${input.cardId} atribuido automaticamente a ${chosen.id}.`);
    } else {
      await this.cardRepository.updateSuggestedOwner(input.cardId, chosen.id);
      this.logger.log(`Lead ${input.cardId} sugerido para ${chosen.id} (aguardando confirmacao).`);
    }
  }

  private pickByRoundRobin(
    onlineCorretores: CorretorRecord[],
    ultimoCorretorId: string | null,
  ): CorretorRecord {
    const sorted = [...onlineCorretores].sort((a, b) => a.id.localeCompare(b.id));
    if (!ultimoCorretorId) {
      return sorted[0];
    }
    const lastIndex = sorted.findIndex((corretor) => corretor.id === ultimoCorretorId);
    // ultimoCorretorId nao esta mais online (ou nunca existiu) - recomeca do primeiro.
    if (lastIndex === -1) {
      return sorted[0];
    }
    return sorted[(lastIndex + 1) % sorted.length];
  }

  private async pickByMenorFila(
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

    withCounts.sort((a, b) => a.count - b.count);
    return withCounts[0].corretor;
  }
}
