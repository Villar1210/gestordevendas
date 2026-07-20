// src/modules/vendas_kanban/application/use-cases/mover-leads-inativos-para-repique.use-case.ts
// Corpo do job diario (ver infra/scheduler/repique-inatividade.scheduler.ts):
// varre TODOS os cards de qualquer tenant sem atualizacao ha 90+ dias que
// ainda nao estao em Fechamento/Repique, e os move para Repique com
// motivoRepique=SEM_RESPOSTA_90_DIAS - a menos que exista uma mensagem de
// WhatsApp (IN ou OUT) mais recente que os 90 dias para o telefone do card,
// caso em que ha interacao real que o Card.updatedAt sozinho nao capturou.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';

const DIAS_INATIVIDADE = 90;
const POSITION_STEP = 1000;

@Injectable()
export class MoverLeadsInativosParaRepiqueUseCase {
  private readonly logger = new Logger(MoverLeadsInativosParaRepiqueUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('IWhatsAppMessageRepository')
    private readonly whatsAppMessageRepository: IWhatsAppMessageRepository,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(Date.now() - DIAS_INATIVIDADE * 24 * 60 * 60 * 1000);
    const candidatos = await this.cardRepository.findElegiveisParaRepiqueJob(cutoff);

    if (candidatos.length === 0) {
      return;
    }

    for (const card of candidatos) {
      try {
        await this.processarCard(card, cutoff);
      } catch (err) {
        // Um card com problema (ex: pipeline sem stage "Repique") nao pode
        // travar os demais - mesmo padrao ja usado em
        // ProcessRoletaTimeoutsUseCase/CardSemDonoCriadoListener.
        this.logger.error(`Erro movendo card ${card.id} para Repique: ${(err as Error).message}`);
      }
    }
  }

  private async processarCard(card: CardRecord, cutoff: Date): Promise<void> {
    if (card.phone) {
      const ultimaMensagem = await this.whatsAppMessageRepository.findMostRecentByTenantAndPhone(
        card.tenantId,
        card.phone,
      );
      if (ultimaMensagem && ultimaMensagem.timestamp >= cutoff) {
        // Houve mensagem (do lead ou automatica) dentro da janela - o card
        // NAO esta realmente inativo, mesmo que Card.updatedAt esteja
        // desatualizado (updatedAt so muda com edicao do proprio card).
        return;
      }
    }

    const stages = await this.stageRepository.findAllByPipeline(card.pipelineId);
    const repiqueStage = stages.find((stage) => stage.name === REPIQUE_STAGE_NAME);
    if (!repiqueStage) {
      this.logger.warn(
        `Pipeline ${card.pipelineId} (tenant ${card.tenantId}) nao tem stage "Repique" - card ${card.id} nao movido.`,
      );
      return;
    }

    if (card.stageId === repiqueStage.id) {
      return; // ja esta em Repique (nao deveria vir do findElegiveisParaRepiqueJob, defesa extra)
    }

    const cardsNaRepique = await this.cardRepository.findAllByStage(repiqueStage.id);
    const novaPosicao =
      cardsNaRepique.length > 0
        ? cardsNaRepique[cardsNaRepique.length - 1].position + POSITION_STEP
        : POSITION_STEP;

    await this.cardRepository.updateStageAndPosition(card.id, repiqueStage.id, novaPosicao, {
      motivoRepique: 'SEM_RESPOSTA_90_DIAS',
      movidoParaRepiqueEm: new Date(),
    });

    this.logger.log(
      `Card ${card.id} (tenant ${card.tenantId}) movido automaticamente para Repique - inativo ha ${DIAS_INATIVIDADE}+ dias.`,
    );
  }
}
