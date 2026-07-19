// src/shared/canais.module.ts
// Modulo novo (nao um dos modulos de negocio existentes) so para dar vida,
// via DI do NestJS, a abstracao aditiva de canais criada nesta fatia -
// MessageDispatcherService e WhatsAppToCanalAdapter precisam estar
// registrados em algum modulo para o Nest instanciar/injetar de verdade.
// Nenhum modulo de negocio (vivi_sdr, atendimento, rh, edoc, auth,
// whatsappmarketing) foi alterado - so importado aqui (WhatsAppMarketingModule
// ja exporta SendWhatsAppMessageUseCase, reaproveitado sem modificacao).
import { Module } from '@nestjs/common';
import { WhatsAppMarketingModule } from '../modules/whatsappmarketing/whatsapp-marketing.module';
import { MessageDispatcherService } from './infra/services/message-dispatcher.service';
import { WhatsAppToCanalAdapter } from './infra/listeners/whatsapp-to-canal.adapter';
import { ResendEmailSender } from './infra/services/resend-email-sender';

@Module({
  imports: [WhatsAppMarketingModule],
  providers: [
    MessageDispatcherService,
    WhatsAppToCanalAdapter,
    // IEmailSender ja e vinculado (ResendEmailSender) dentro de auth/rh/edoc
    // hoje - vinculado aqui tambem porque cada modulo Nest tem seu proprio
    // escopo de DI (nao ha um SharedModule global no projeto ate hoje).
    { provide: 'IEmailSender', useClass: ResendEmailSender },
    { provide: 'IMessageDispatcher', useClass: MessageDispatcherService },
  ],
  exports: ['IMessageDispatcher', MessageDispatcherService],
})
export class CanaisModule {}
