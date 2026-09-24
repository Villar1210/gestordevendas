// src/modules/whatsappmarketing/application/use-cases/send-whatsapp-message.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

export const CHATWOOT_VIRTUAL_SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export interface IChatwootOutboundSender {
  enviarMensagem(params: { telefone: string; mensagem: string }): Promise<void>;
}

interface SendWhatsAppMessageInput {
  sessionId: string;
  tenantId: string;
  to: string;
  body: string;
  phoneNumber?: string;
  simularDigitando?: boolean;
}

@Injectable()
export class SendWhatsAppMessageUseCase {
  private readonly logger = new Logger(SendWhatsAppMessageUseCase.name);

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
    @Optional() @Inject('IChatwootOutboundSender')
    private readonly chatwootSender?: IChatwootOutboundSender,
  ) {}

  async execute(input: SendWhatsAppMessageInput): Promise<void> {
    if (input.sessionId === CHATWOOT_VIRTUAL_SESSION_ID) {
      if (!this.chatwootSender) {
        this.logger.error('IChatwootOutboundSender nao injetado.');
        throw new BadRequestException('Sender Chatwoot nao disponivel.');
      }
      const telefone = input.phoneNumber ?? input.to.replace(/\D/g, '');
      await this.chatwootSender.enviarMensagem({ telefone, mensagem: input.body });
      return;
    }

    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    if (session.status !== 'CONNECTED') {
      throw new BadRequestException('Sessao WhatsApp nao esta conectada.');
    }

    if (!this.whatsAppProvider.isConnected(session.id)) {
      throw new BadRequestException(
        'Sessao WhatsApp nao esta conectada (socket real desconectado, apesar do status gravado).',
      );
    }

    await this.whatsAppProvider.sendMessage(
      session.id,
      input.to,
      input.body,
      input.phoneNumber,
      input.simularDigitando,
    );
  }
}
