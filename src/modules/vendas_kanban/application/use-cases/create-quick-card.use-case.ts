// src/modules/vendas_kanban/application/use-cases/create-quick-card.use-case.ts
// Cria um card "cru", sem stage e sem dono (Caixa de Entrada). Representa a
// chegada de um lead ainda nao qualificado - hoje disparado manualmente para
// testes, no futuro sera o ponto de entrada dos webhooks de redes sociais.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface CreateQuickCardInput {
  tenantId: string;
  pipelineId: string;
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

    // Dispara a Roleta Online (se estiver ativa) - emit() nao aguarda o
    // listener, nao bloqueia a criacao do card (mesmo padrao do
    // BaileysWhatsAppProvider para nao acoplar os modulos entre si).
    // SO dispara se o card realmente caiu na Caixa de Entrada (sem stageId) -
    // um card criado ja com stage explicito (ex: "Repique", deposito
    // estrategico para remarketing futuro) foi posicionado de proposito e
    // NAO deve ser distribuido/movido pela Roleta.
    if (!card.stageId) {
      this.eventEmitter.emit('card.sem_dono.criado', {
        tenantId: input.tenantId,
        cardId: card.id,
        pipelineId: pipeline.id,
      });
    }

    return card;
  }
}
