// src/modules/whatsappmarketing/whatsapp-marketing.module.ts
import { Module } from '@nestjs/common';
import { WhatsAppController } from './infra/http/whatsapp.controller';
import { CreateWhatsAppSessionUseCase } from './application/use-cases/create-whatsapp-session.use-case';
import { SendWhatsAppMessageUseCase } from './application/use-cases/send-whatsapp-message.use-case';
import { DisconnectWhatsAppSessionUseCase } from './application/use-cases/disconnect-whatsapp-session.use-case';
import { GetWhatsAppQrCodeUseCase } from './application/use-cases/get-whatsapp-qr-code.use-case';
import { GetWhatsAppSessionStatusUseCase } from './application/use-cases/get-whatsapp-session-status.use-case';
import { GetMyWhatsAppSessionUseCase } from './application/use-cases/get-my-whatsapp-session.use-case';
import { PrismaWhatsAppSessionRepository } from './infra/database/prisma-whatsapp-session.repository';
import { PrismaWhatsAppMessageRepository } from './infra/database/prisma-whatsapp-message.repository';
import { BaileysWhatsAppProvider } from './infra/providers/baileys-whatsapp-provider';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [WhatsAppController],
  providers: [
    PrismaService,
    CreateWhatsAppSessionUseCase,
    SendWhatsAppMessageUseCase,
    DisconnectWhatsAppSessionUseCase,
    GetWhatsAppQrCodeUseCase,
    GetWhatsAppSessionStatusUseCase,
    GetMyWhatsAppSessionUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / Baileys).
    { provide: 'IWhatsAppSessionRepository', useClass: PrismaWhatsAppSessionRepository },
    { provide: 'IWhatsAppMessageRepository', useClass: PrismaWhatsAppMessageRepository },
    { provide: 'IWhatsAppProvider', useClass: BaileysWhatsAppProvider },
  ],
  // Exportados para o modulo vivi_sdr: o listener de eventos precisa checar
  // isAiEnabled/ler historico, e o caso de uso de resposta precisa enviar
  // a mensagem de volta ao lead.
  exports: [
    SendWhatsAppMessageUseCase,
    'IWhatsAppSessionRepository',
    'IWhatsAppMessageRepository',
  ],
})
export class WhatsAppMarketingModule {}
