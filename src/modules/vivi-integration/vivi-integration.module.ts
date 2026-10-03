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

@Module({
  imports: [
    ConfigModule,
    ViviSdrModule,
    FollowUpModule,
    VendasKanbanModule,
  ],
  // LeadsViviController: Fatia 3 (WhatsApp do corretor - leads da VIVI)
  controllers: [ViviIntegrationController, SimuladorCreditoController, LeadsViviController],
  providers: [
    PrismaService,
    ChatwootWhatsappService,
    MoverCardViviUseCase,
    SimularCreditoUseCase,
    LeadsViviUseCases,
    LeadsViviRepository,
    { provide: 'IChatwootOutboundSender', useExisting: ChatwootWhatsappService },
  ],
  exports: [ChatwootWhatsappService],
})
export class ViviIntegrationModule {}
