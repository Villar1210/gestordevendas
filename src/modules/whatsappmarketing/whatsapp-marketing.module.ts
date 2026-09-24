// src/modules/whatsappmarketing/whatsapp-marketing.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsAppController],
  providers: [
    PrismaService,
    CreateWhatsAppSessionUseCase,
    SendWhatsAppMessageUseCase,
    DisconnectWhatsAppSessionUseCase,
    GetWhatsAppQrCodeUseCase,
    GetWhatsAppSessionStatusUseCase,
    GetMyWhatsAppSessionUseCase,
    { provide: 'IWhatsAppSessionRepository', useClass: PrismaWhatsAppSessionRepository },
    { provide: 'IWhatsAppMessageRepository', useClass: PrismaWhatsAppMessageRepository },
    { provide: 'IWhatsAppProvider', useClass: BaileysWhatsAppProvider },
    // Sender Chatwoot Cloud API — injetado opcionalmente no SendWhatsAppMessageUseCase
    // para redirecionar mensagens da sessão virtual VIVI (CHATWOOT_VIRTUAL_SESSION_ID).
    ChatwootWhatsappService,
    { provide: 'IChatwootOutboundSender', useExisting: ChatwootWhatsappService },
  ],
  exports: [
    SendWhatsAppMessageUseCase,
    'IWhatsAppSessionRepository',
    'IWhatsAppMessageRepository',
  ],
})
export class WhatsAppMarketingModule {}
