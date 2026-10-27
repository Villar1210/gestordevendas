// src/modules/vendas_kanban/application/use-cases/create-quick-card.use-case.ts
// Cria um card "cru", sem stage e sem dono (Caixa de Entrada). Representa a
// chegada de um lead ainda nao qualificado - hoje disparado manualmente para
// testes, no futuro sera o ponto de entrada dos webhooks de redes sociais.
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';
import {
  CARD_STAGE_CHANGED_EVENT,
  CardStageChangedEvent,
} from '../../domain/events/card-stage-changed.event';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { INoteRepository } from '../../domain/repositories/note-repository.interface';
import { chaveTelefone, trechoBuscaTelefone } from '../../domain/services/telefone';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';

// Evento emitido quando um cliente que JA tem card aberto entra de novo
// (site, WhatsApp, rede social, cadastro rapido). Escutado pelo modulo
// notificacoes para avisar o corretor dono.
export const LEAD_REENTRADA_EVENT = 'lead.reentrada';
export interface LeadReentradaEvent {
  tenantId: string;
  cardId: string;
  ownerId: string;
  origem: string;
}

// Retorno: o card criado OU, quando o telefone ja tinha card aberto, o card
// existente com reaproveitado=true (nenhum card novo foi criado).
export type QuickCardResult = CardRecord & { reaproveitado?: boolean };

interface CreateQuickCardInput {
  tenantId: string;
  pipelineId: string;
  // Restricao de visibilidade do funil de remarketing (ver
  // domain/services/remarketing-pipeline.ts) - mesma checagem ja aplicada
  // em GetBoardUseCase/ClaimCardUseCase/GetInboxUseCase. So relevante para
  // chamadas humanas (isSystemCall ausente/false) - ver isSystemCall abaixo.
  requesterRole?: string;
  requesterCargo?: string | null;
  // true para chamadores internos de sistema (CapturarLeadMinimoUseCase, que
  // e o proprio mecanismo que deposita neste funil, e os fluxos da VIVI) -
  // pula a checagem podeAcessarPipelineRemarketing por completo, mesmo sem
  // requesterRole/requesterCargo preenchidos. Flag explicita em vez de
  // reaproveitar requesterRole com um valor fixo tipo 'Administrador': um
  // bypass escondido dentro de um campo que parece uma role real passaria
  // despercebido se este use case ganhar um caller humano novo no futuro.
  isSystemCall?: boolean;
  title: string;
  value?: number;
  origem?: string;
  phone?: string;
  temperatura?: string;
  imovelId?: string;
  // Fatia 2 (Sorteio da vez): produto de interesse - decide em qual Roleta
  // de produto o lead e sorteado (preenchido pela VIVI no agendamento).
  empreendimentoId?: string | null;
  customFields?: Record<string, unknown>;
  // Nulo/omitido = Caixa de Entrada (comportamento padrao ja existente).
  // Preenchido pela VIVI para depositar leads sem perfil de renda direto
  // na coluna "Repique" (ver ProcessIncomingMessageUseCase).
  stageId?: string | null;
  // Resumo automatico legivel pelo corretor sem abrir outra tela (ver
  // vivi_sdr/domain/services/build-resumo-atendimento.ts).
  description?: string;
  // Preenchido pela VIVI quando motivo="sem_perfil" (ver
  // ProcessIncomingMessageUseCase) - mesmo motivo ja usado pelo modal
  // manual e pelo job de inatividade (domain/services/motivo-repique.ts).
  // movidoParaRepiqueEm e derivado automaticamente (momento da criacao),
  // nao precisa ser passado pelo chamador.
  motivoRepique?: string;
  // Fase B (27/10/2026): por padrao, um lead que chega para a Caixa de
  // Entrada (sem stageId) com telefone que JA tem card aberto NAO cria card
  // novo - entra no card existente (nota + aviso ao dono). false desliga
  // (nenhum chamador usa hoje; existe para casos excepcionais/testes).
  deduplicarPorTelefone?: boolean;
}

@Injectable()
export class CreateQuickCardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('INoteRepository') private readonly noteRepository: INoteRepository,
  ) {}

  async execute(input: CreateQuickCardInput): Promise<QuickCardResult> {
    const pipeline = await this.pipelineRepository.findByIdAndTenant(
      input.pipelineId,
      input.tenantId,
    );
    if (!pipeline) {
      throw new NotFoundException('Pipeline nao encontrado.');
    }

    if (
      pipeline.name === REMARKETING_PIPELINE_NOME &&
      !input.isSystemCall &&
      !podeAcessarPipelineRemarketing(input.requesterRole ?? '', input.requesterCargo ?? null)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    // Fase B: mesmo cliente nao vira 2 cards. So para entrada na Caixa de
    // Entrada (sem stage explicita) e fora do funil de remarketing.
    if (
      input.deduplicarPorTelefone !== false &&
      !input.stageId &&
      input.phone &&
      pipeline.name !== REMARKETING_PIPELINE_NOME
    ) {
      const existente = await this.encontrarCardAberto(input.tenantId, input.phone);
      if (existente) {
        return this.registrarReentrada(existente, input);
      }
    }

    const card = await this.cardRepository.create({
      tenantId: input.tenantId,
      pipelineId: pipeline.id,
      stageId: input.stageId ?? null,
      ownerId: null,
      title: input.title,
      value: input.value,
      origem: input.origem ?? 'webhook',
      phone: input.phone,
      temperatura: input.temperatura,
      imovelId: input.imovelId,
      empreendimentoId: input.empreendimentoId ?? null,
      description: input.description,
      customFields: input.customFields,
      position: 0,
      motivoRepique: input.motivoRepique ?? null,
      movidoParaRepiqueEm: input.motivoRepique ? new Date() : null,
    });

    // Dispara a Roleta Online (se estiver ativa). Integracao VIVI (2026):
    // trocado de emit() para emitAsync() - a mensagem de confirmacao
    // estruturada de agendar_visita (ver AgendarVisitaUseCase) precisa ler
    // o Card.ownerId JA atribuido pela Roleta ao continuar depois deste
    // metodo retornar; com emit() (fire-and-forget) isso era uma condicao
    // de corrida - nada garantia que o listener (CardSemDonoCriadoListener)
    // ja tivesse terminado. So existe 1 listener deste evento hoje. Efeito
    // colateral aceito (decisao do usuario): callers deste metodo (webhook,
    // criacao manual) passam a esperar a Roleta terminar antes de retornar -
    // impacto de latencia baixo, so 1 listener rapido.
    // SO dispara se o card realmente caiu na Caixa de Entrada (sem stageId) -
    // um card criado ja com stage explicito (ex: "Repique", deposito
    // estrategico para remarketing futuro) foi posicionado de proposito e
    // NAO deve ser distribuido/movido pela Roleta.
    // Historico de etapas (BII): card criado ja com stage (ex: "Repique" pela
    // VIVI, ou a stage do funil de remarketing) = entrada no funil. Card na
    // Caixa de Entrada (sem stage) nao gera evento aqui - o evento sai quando
    // alguem o assume (ClaimCardUseCase).
    if (card.stageId) {
      const evento: CardStageChangedEvent = {
        tenantId: input.tenantId,
        cardId: card.id,
        pipelineId: pipeline.id,
        fromStageId: null,
        toStageId: card.stageId,
        userId: null,
        origem: 'criacao',
        ocorridoEm: new Date(),
        motivoRepique: input.motivoRepique ?? null,
      };
      this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);
    }

    if (!card.stageId) {
      await this.eventEmitter.emitAsync('card.sem_dono.criado', {
        tenantId: input.tenantId,
        cardId: card.id,
        pipelineId: pipeline.id,
      });
    }

    return card;
  }

  private async encontrarCardAberto(tenantId: string, phone: string): Promise<CardRecord | null> {
    const chave = chaveTelefone(phone);
    if (!chave) return null;
    const candidatos = await this.cardRepository.findAbertosPorTrechoTelefone(
      tenantId,
      trechoBuscaTelefone(phone),
    );
    // Ja vem do mais recente para o mais antigo.
    return candidatos.find((c) => chaveTelefone(c.phone) === chave) ?? null;
  }

  // Cliente que ja tem card aberto entrou de novo: registra a entrada no card
  // existente e:
  // - card com corretor: avisa o dono (evento lead.reentrada); se estava no
  //   Repique, volta para a 1a etapa do funil com o mesmo corretor
  //   (Etapa 5 do mapa: "volta ao corretor dono");
  // - card sem corretor no Repique: volta para a Caixa de Entrada e passa
  //   pela Roleta;
  // - card sem corretor na Caixa de Entrada: so a nota (ja esta na fila).
  private async registrarReentrada(
    existente: CardRecord,
    input: CreateQuickCardInput,
  ): Promise<QuickCardResult> {
    const origem = input.origem ?? 'webhook';
    const detalhe = input.description?.trim() ? `\n${input.description.trim().slice(0, 1000)}` : '';
    await this.noteRepository.create({
      tenantId: input.tenantId,
      cardId: existente.id,
      body: `Cliente entrou em contato de novo (origem: ${origem}).${detalhe}`,
    });

    const noRepique = existente.stageName === REPIQUE_STAGE_NAME;

    if (existente.ownerId) {
      if (noRepique) {
        const stages = await this.stageRepository.findAllByPipeline(existente.pipelineId);
        const primeira = [...stages].sort((a, b) => a.position - b.position)[0];
        if (primeira && primeira.id !== existente.stageId) {
          await this.cardRepository.updateStageAndPosition(existente.id, primeira.id, 0);
          const evento: CardStageChangedEvent = {
            tenantId: input.tenantId,
            cardId: existente.id,
            pipelineId: existente.pipelineId,
            fromStageId: existente.stageId,
            toStageId: primeira.id,
            userId: null,
            origem: 'promocao',
            ocorridoEm: new Date(),
          };
          this.eventEmitter.emit(CARD_STAGE_CHANGED_EVENT, evento);
        }
      }
      const aviso: LeadReentradaEvent = {
        tenantId: input.tenantId,
        cardId: existente.id,
        ownerId: existente.ownerId,
        origem,
      };
      this.eventEmitter.emit(LEAD_REENTRADA_EVENT, aviso);
    } else if (existente.stageId) {
      // Sem dono e fora da Caixa de Entrada (ex.: Repique sem corretor):
      // volta para a fila da Roleta.
      await this.cardRepository.moverParaCaixaDeEntrada(existente.id);
      await this.eventEmitter.emitAsync('card.sem_dono.criado', {
        tenantId: input.tenantId,
        cardId: existente.id,
        pipelineId: existente.pipelineId,
      });
    }

    const atualizado = await this.cardRepository.findByIdAndTenant(existente.id, input.tenantId);
    return { ...(atualizado ?? existente), reaproveitado: true };
  }
}
