// src/modules/vivi_sdr/infra/listeners/whatsapp-message-received.listener.ts
// Escuta o evento generico emitido pelo BaileysWhatsAppProvider (modulo
// whatsappmarketing). Nao ha import direto entre os dois modulos - o unico
// contrato compartilhado e o nome do evento e o formato do payload, por
// convencao. Ver CLAUDE.md "Decisao tecnica: Organizacao de pastas por modulo".
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { ProcessIncomingMessageUseCase } from '../../application/use-cases/process-incoming-message.use-case';

interface WhatsAppMessageReceivedEvent {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  messageBody: string;
}

@Injectable()
export class WhatsAppMessageReceivedListener {
  private readonly logger = new Logger(WhatsAppMessageReceivedListener.name);

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
  ) {}

  @OnEvent('whatsapp.message.received')
  async handle(event: WhatsAppMessageReceivedEvent): Promise<void> {
    const session = await this.sessionRepository.findById(event.sessionId);
    if (!session || !session.isAiEnabled) {
      return;
    }

    try {
      await this.processIncomingMessageUseCase.execute(event);
    } catch (error) {
      // Nunca deixa uma falha na VIVI derrubar o processamento de mensagens
      // do WhatsApp - so registra o erro.
      this.logger.error(
        `Falha ao processar mensagem recebida pela VIVI (sessao ${event.sessionId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
