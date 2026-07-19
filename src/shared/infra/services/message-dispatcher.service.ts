// src/shared/infra/services/message-dispatcher.service.ts
// Camada de INFRA: implementa IMessageDispatcher reaproveitando o que ja
// existe e esta em producao - SendWhatsAppMessageUseCase (modulo
// whatsappmarketing) e IEmailSender (Resend) - SEM alterar nenhum dos dois.
// SMS/Instagram/Facebook lancam erro claro ate um provedor real ser
// plugado numa fatia futura.
import { Injectable, Inject, BadRequestException, NotImplementedException } from '@nestjs/common';
import { Canal } from '../../domain/enums/canal.enum';
import {
  IMessageDispatcher,
  EnviarMensagemInput,
} from '../../domain/services/message-dispatcher.interface';
import { IEmailSender } from '../../domain/services/email-sender.interface';
import { SendWhatsAppMessageUseCase } from '../../../modules/whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';

@Injectable()
export class MessageDispatcherService implements IMessageDispatcher {
  constructor(
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  async enviar(input: EnviarMensagemInput): Promise<void> {
    switch (input.canal) {
      case Canal.WHATSAPP:
        return this.enviarWhatsApp(input);
      case Canal.EMAIL:
        return this.enviarEmail(input);
      case Canal.SMS:
      case Canal.INSTAGRAM:
      case Canal.FACEBOOK:
        throw new NotImplementedException(
          `Canal ${input.canal} ainda nao implementado - sera plugado numa fatia futura.`,
        );
      default:
        throw new BadRequestException(`Canal desconhecido: ${input.canal}`);
    }
  }

  private async enviarWhatsApp(input: EnviarMensagemInput): Promise<void> {
    if (!input.whatsappSessionId) {
      throw new BadRequestException('whatsappSessionId e obrigatorio para o canal WHATSAPP.');
    }
    await this.sendWhatsAppMessageUseCase.execute({
      sessionId: input.whatsappSessionId,
      tenantId: input.tenantId,
      to: input.destinatario,
      body: input.conteudo,
    });
  }

  private async enviarEmail(input: EnviarMensagemInput): Promise<void> {
    if (!input.assunto) {
      throw new BadRequestException('assunto e obrigatorio para o canal EMAIL.');
    }
    await this.emailSender.send({
      to: input.destinatario,
      subject: input.assunto,
      body: input.conteudo,
    });
  }
}
