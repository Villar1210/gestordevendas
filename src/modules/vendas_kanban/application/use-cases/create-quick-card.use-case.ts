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
}

@Injectable()
export class CreateQuickCardUseCase {
  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: CreateQuickCardInput): Promise<CardRecord> {
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
    if (!card.stageId) {
      await this.eventEmitter.emitAsync('card.sem_dono.criado', {
        tenantId: input.tenantId,
        cardId: card.id,
        pipelineId: pipeline.id,
      });
    }

    return card;
  }
}
