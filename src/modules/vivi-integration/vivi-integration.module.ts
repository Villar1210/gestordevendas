import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ViviIntegrationController } from './infra/http/vivi-integration.controller';
import { SimuladorCreditoController } from './infra/http/simulador-credito.controller';
import { ChatwootWhatsappService } from './services/chatwoot-whatsapp.service';
import { ViviSdrModule } from '../vivi_sdr/vivi-sdr.module';
import { PrismaService } from '../../config/prisma.service';
import { FollowUpModule } from '../follow-up/follow-up.module';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { MoverCardViviUseCase } from './application/use-cases/mover-card-vivi.use-case';
import { SimularCreditoUseCase } from './application/use-cases/simular-credito.use-case';
import { LeadsViviController } from './infra/http/leads-vivi.controller';
import { LeadsViviUseCases } from './application/use-cases/leads-vivi.use-cases';
import { LeadsViviRepository } from './infra/database/leads-vivi.repository';
import { ChatwootWebhookController } from './infra/http/chatwoot-webhook.controller';
import { RegistrarMensagemChatwootUseCase } from './application/use-cases/registrar-mensagem-chatwoot.use-case';
import { ChatwootMensagemRepository } from './infra/database/chatwoot-mensagem.repository';

@Module({
  imports: [
    ConfigModule,
    ViviSdrModule,
    FollowUpModule,
    VendasKanbanModule,
  ],
  // LeadsViviController: Fatia 3 (WhatsApp do corretor - leads da VIVI)
  // ChatwootWebhookController: WhatsApp integrado, Etapa 1 parte 2 (webhook assinado)
  controllers: [ViviIntegrationController, SimuladorCreditoController, LeadsViviController, ChatwootWebhookController],
  providers: [
    PrismaService,
    ChatwootWhatsappService,
    MoverCardViviUseCase,
    SimularCreditoUseCase,
    LeadsViviUseCases,
    LeadsViviRepository,
    RegistrarMensagemChatwootUseCase,
    ChatwootMensagemRepository,
    { provide: 'IChatwootOutboundSender', useExisting: ChatwootWhatsappService },
  ],
  exports: [ChatwootWhatsappService],
})
export class ViviIntegrationModule {}
