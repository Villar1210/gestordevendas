// src/modules/vivi_sdr/infra/listeners/whatsapp-message-received.listener.ts
// Escuta o evento generico emitido pelo BaileysWhatsAppProvider (modulo
// whatsappmarketing). Nao ha import direto entre os dois modulos - o unico
// contrato compartilhado e o nome do evento e o formato do payload, por
// convencao. Ver CLAUDE.md "Decisao tecnica: Organizacao de pastas por modulo".
//
// Duas responsabilidades no mesmo listener (Central de Atendimento, ver
// CLAUDE.md): sessao COM VIVI ativa -> processa via IA
// (ProcessIncomingMessageUseCase); sessao SEM VIVI -> cai direto na Central
// de Atendimento (GetOrCreateAtendimentoUseCase), sem fila ainda, para um
// Administrador classificar manualmente. atendimento nao importa vivi_sdr de
// volta - dependencia so nesse sentido (vivi_sdr -> atendimento), sem ciclo.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { ProcessIncomingMessageUseCase } from '../../application/use-cases/process-incoming-message.use-case';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { VIVI_INTERNA_ATIVA } from '../../constants/vivi-interna';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { funilDeVendasPadrao } from '../../../vendas_kanban/domain/services/remarketing-pipeline';

interface WhatsAppMessageReceivedEvent {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  remoteJid: string;
  messageBody: string;
  // Nome de exibicao do WhatsApp do contato (ver BaileysWhatsAppProvider) -
  // repassado adiante por processIncomingMessageUseCase.execute(event) para
  // a captura automatica de lead minimo (funil de remarketing).
  pushName?: string | null;
}

@Injectable()
export class WhatsAppMessageReceivedListener {
  private readonly logger = new Logger(WhatsAppMessageReceivedListener.name);

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  @OnEvent('whatsapp.message.received')
  async handle(event: WhatsAppMessageReceivedEvent): Promise<void> {
    const session = await this.sessionRepository.findById(event.sessionId);
    if (!session) {
      return;
    }

    try {
      // VIVI interna desligada (27/10/2026, ver constants/vivi-interna.ts):
      // mesmo sessao com isAiEnabled=true antigo cai na Central de
      // Atendimento, nunca no Claude.
      if (VIVI_INTERNA_ATIVA && session.isAiEnabled) {
        await this.processIncomingMessageUseCase.execute(event);
      } else {
        const atendimento = await this.getOrCreateAtendimentoUseCase.execute({
          tenantId: event.tenantId,
          sessionId: event.sessionId,
          remoteJid: event.remoteJid,
          phoneNumber: event.phoneNumber,
        });
        // Fase B (Q4, 27/10/2026): a 1a mensagem de cada conversa tambem
        // entra no Kanban - card na Caixa de Entrada (Roleta) ou, se o
        // cliente ja tem card aberto, nota + aviso ao corretor dono.
        if (atendimento.criadoAgora) {
          await this.registrarLeadNoKanban(event);
        }
      }
    } catch (error) {
      // Nunca deixa uma falha na VIVI/Central de Atendimento derrubar o
      // processamento de mensagens do WhatsApp - so registra o erro.
      this.logger.error(
        `Falha ao processar mensagem recebida (sessao ${event.sessionId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async registrarLeadNoKanban(event: WhatsAppMessageReceivedEvent): Promise<void> {
    const pipelines = await this.pipelineRepository.findAllByTenant(event.tenantId);
    const funil = funilDeVendasPadrao(pipelines);
    if (!funil) {
      this.logger.warn(`WhatsApp sem VIVI: tenant ${event.tenantId} sem funil de vendas - card nao criado.`);
      return;
    }
    const trecho = (event.messageBody ?? '').trim().slice(0, 500);
    await this.createQuickCardUseCase.execute({
      tenantId: event.tenantId,
      pipelineId: funil.id,
      isSystemCall: true,
      title: event.pushName?.trim() || 'Contato pelo WhatsApp',
      origem: 'whatsapp',
      phone: event.phoneNumber,
      description: trecho ? `Primeira mensagem pelo WhatsApp: "${trecho}"` : undefined,
    });
  }
}
