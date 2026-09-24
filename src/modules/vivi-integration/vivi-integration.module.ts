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

@Module({
  imports: [
    ConfigModule,
    ViviSdrModule,
    FollowUpModule,
    VendasKanbanModule,
  ],
  controllers: [ViviIntegrationController, SimuladorCreditoController],
  providers: [
    PrismaService,
    ChatwootWhatsappService,
    MoverCardViviUseCase,
    SimularCreditoUseCase,
    { provide: 'IChatwootOutboundSender', useExisting: ChatwootWhatsappService },
  ],
  exports: [ChatwootWhatsappService],
})
export class ViviIntegrationModule {}
