// src/modules/vivi_sdr/vivi-sdr.module.ts
import { Module } from '@nestjs/common';
import { WhatsAppMarketingModule } from '../whatsappmarketing/whatsapp-marketing.module';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { AtendimentoModule } from '../atendimento/atendimento.module';
import { ViviSessionController } from './infra/http/vivi-session.controller';
import { ViviConversationController } from './infra/http/vivi-conversation.controller';
import { EnableViviOnSessionUseCase } from './application/use-cases/enable-vivi-on-session.use-case';
import { DisableViviOnSessionUseCase } from './application/use-cases/disable-vivi-on-session.use-case';
import { ListViviConversationsUseCase } from './application/use-cases/list-vivi-conversations.use-case';
import { ProcessIncomingMessageUseCase } from './application/use-cases/process-incoming-message.use-case';
import { AgendarVisitaUseCase } from './application/use-cases/agendar-visita.use-case';
import { WhatsAppMessageReceivedListener } from './infra/listeners/whatsapp-message-received.listener';
import { PrismaViviConversationRepository } from './infra/database/prisma-vivi-conversation.repository';
import { AnthropicConversationService } from '../../shared/infra/services/anthropic-conversation.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  // Dependencia de modulo (nao circular): vivi_sdr consome use cases ja
  // exportados por whatsappmarketing, vendas_kanban e atendimento (Central
  // de Atendimento - GetOrCreateAtendimentoUseCase/
  // ClassifyAndRouteAtendimentoUseCase, usados pelo listener e pela tool
  // "transferir_para_fila"). O caminho inverso (whatsappmarketing ->
  // vivi_sdr, atendimento -> vivi_sdr) nao existe - os providers so emitem
  // eventos genericos, ver infra/listeners/whatsapp-message-received.listener.ts.
  imports: [WhatsAppMarketingModule, VendasKanbanModule, AtendimentoModule],
  controllers: [ViviSessionController, ViviConversationController],
  providers: [
    PrismaService,
    EnableViviOnSessionUseCase,
    DisableViviOnSessionUseCase,
    ListViviConversationsUseCase,
    ProcessIncomingMessageUseCase,
    AgendarVisitaUseCase,
    WhatsAppMessageReceivedListener,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / Anthropic).
    { provide: 'IViviConversationRepository', useClass: PrismaViviConversationRepository },
    { provide: 'IAiConversationService', useClass: AnthropicConversationService },
  ],
})
export class ViviSdrModule {}
