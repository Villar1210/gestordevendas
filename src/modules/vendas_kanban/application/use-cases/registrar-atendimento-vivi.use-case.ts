// src/modules/vendas_kanban/application/use-cases/registrar-atendimento-vivi.use-case.ts
// Fase B (27/10/2026, Etapa 1 do mapa de processos): a VIVI do fazer.ai avisa
// o Gestor a cada mensagem do cliente (rota POST /vivi/lead-em-atendimento).
// O lead aparece na coluna "Atendimento VIVI" - fora da Caixa de Entrada e da
// Roleta - ate a VIVI qualificar (agendar visita / pedir corretor, que passam
// pelo CreateQuickCardUseCase e levam o card para a Roleta).
//
// Idempotente: pode ser chamado em toda mensagem. Situacoes:
// - telefone sem card aberto -> cria card na coluna;
// - ja na coluna -> so registra a interacao (zera o prazo de 7 dias);
// - card com corretor -> registra a interacao; se estava no Repique volta
//   para a 1a etapa com o mesmo corretor; avisa o corretor no maximo 1 vez a
//   cada 12 h (o fazer.ai chama a cada mensagem);
// - Repique (ou outra etapa) sem corretor -> volta para a coluna;
// - Caixa de Entrada aguardando a Roleta -> so registra a interacao.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { funilDeVendasPadrao } from '../../domain/services/remarketing-pipeline';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { CARD_STAGE_CHANGED_EVENT, CardStageChangedEvent } from '../../domain/events/card-stage-changed.event';
import { CardAbertoPorTelefoneService } from '../services/card-aberto-por-telefone.service';
import { LEAD_REENTRADA_EVENT, LeadReentradaEvent } from './create-quick-card.use-case';

export const INTERVALO_AVISO_CORRETOR_MS = 12 * 60 * 60 * 1000;

export interface RegistrarAtendimentoViviInput {
  tenantId: string;
  phone: string;
  nome?: string | null;
  mensagem?: string | null;
  agora?: Date;
}

export type SituacaoAtendimentoVivi = 'em_atendimento_vivi' | 'com_corretor' | 'aguardando_corretor';

export interface RegistrarAtendimentoViviResult {
  cardId: string;
  situacao: SituacaoAtendimentoVivi;
  criado: boolean;
}

@Injectable()
export class RegistrarAtendimentoViviUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    private readonly cardAbertoPorTelefone: CardAbertoPorTelefoneService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: RegistrarAtendimentoViviInput): Promise<RegistrarAtendimentoViviResult> {
    const agora = input.agora ?? new Date();
    const existente = await this.cardAbertoPorTelefone.encontrar(input.tenantId, input.phone);

    if (!existente) {
      const funil = funilDeVendasPadrao(await this.pipelineRepository.findAllByTenant(input.tenantId));
      if (!funil) throw new NotFoundException('Empresa sem funil de vendas.');
      const trecho = (input.mensagem ?? '').trim().slice(0, 500);
      const card = await this.cardRepository.create({
        tenantId: input.tenantId,
        pipelineId: funil.id,
        stageId: null,
        ownerId: null,
        title: input.nome?.trim() || 'Contato pela VIVI',
        position: 0,
        origem: 'vivi',
        phone: input.phone,
        description: trecho ? `Primeira mensagem para a VIVI: "${trecho}"` : null,
        emAtendimentoVivi: true,
        ultimaInteracaoViviEm: agora,
      });
      return { cardId: card.id, situacao: 'em_atendimento_vivi', criado: true };
    }

    if (existente.emAtendimentoVivi) {
      await this.cardRepository.registrarInteracaoVivi(existente.id, agora);
      return { cardId: existente.id, situacao: 'em_atendimento_vivi', criado: false };
    }

    if (existente.ownerId) {
      const ultimoContato = existente.ultimaInteracaoViviEm?.getTime() ?? 0;
      await this.cardRepository.registrarInteracaoVivi(existente.id, agora);
      if (existente.stageName === REPIQUE_STAGE_NAME) {
        await this.voltarParaPrimeiraEtapa(existente.id, existente.pipelineId, existente.stageId, input.tenantId);
      }
      if (agora.getTime() - ultimoContato >= INTERVALO_AVISO_CORRETOR_MS) {
        const aviso: LeadReentradaEvent = {
          tenantId: input.tenantId,
          cardId: existente.id,
          ownerId: existente.ownerId,
          origem: 'vivi',
        };
        this.eventEmitter.emit(LEAD_REENTRADA_EVENT, aviso);
      }
      return { cardId: existente.id, situacao: 'com_corretor', criado: false };
    }

    if (existente.stageId) {
      // Sem corretor e numa etapa (ex.: Repique): a VIVI retoma a conversa.
      await this.cardRepository.marcarAtendimentoVivi(existente.id, agora);
      return { cardId: existente.id, situacao: 'em_atendimento_vivi', criado: false };
    }

    // Na Caixa de Entrada esperando a Roleta: so registra.
    await this.cardRepository.registrarInteracaoVivi(existente.id, agora);
    return { cardId: existente.id, situacao: 'aguardando_corretor', criado: false };
  }

  private async voltarParaPrimeiraEtapa(
    cardId: string,
    pipelineId: string,
    stageAtual: string | null,
    tenantId: string,
  ): Promise<void> {
    const stages = await this.stageRepository.findAllByPipeline(pipelineId);
    const primeira = [...stages].sort((a, b) => a.position - b.position)[0];
    if (!primeira || primeira.id === stageAtual) return;
    await this.cardRepository.updateStageAndPosition(cardId, primeira.id, 0);
    const evento: CardStageChangedEvent = {
      tenantId,
      cardId,
      pipelineId,
      fromStageId: stageAtual,
      toStageId: primeira.id,
      userId: null,
      origem: 'promocao',
      ocorridoEm: new Date(),
    };
    this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);
  }
}
