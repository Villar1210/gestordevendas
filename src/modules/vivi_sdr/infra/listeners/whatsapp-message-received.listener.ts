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

interface WhatsAppMessageReceivedEvent {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  remoteJid: string;
  messageBody: string;
}

@Injectable()
export class WhatsAppMessageReceivedListener {
  private readonly logger = new Logger(WhatsAppMessageReceivedListener.name);

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
  ) {}

  @OnEvent('whatsapp.message.received')
  async handle(event: WhatsAppMessageReceivedEvent): Promise<void> {
    const session = await this.sessionRepository.findById(event.sessionId);
    if (!session) {
      return;
    }

    try {
      if (session.isAiEnabled) {
        await this.processIncomingMessageUseCase.execute(event);
      } else {
        await this.getOrCreateAtendimentoUseCase.execute({
          tenantId: event.tenantId,
          sessionId: event.sessionId,
          remoteJid: event.remoteJid,
          phoneNumber: event.phoneNumber,
        });
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
}
