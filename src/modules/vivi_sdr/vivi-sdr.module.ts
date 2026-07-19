// src/modules/vivi_sdr/vivi-sdr.module.ts
import { Module } from '@nestjs/common';
import { WhatsAppMarketingModule } from '../whatsappmarketing/whatsapp-marketing.module';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { AtendimentoModule } from '../atendimento/atendimento.module';
import { GestaoImobiliariaModule } from '../gestao_imobiliaria/gestao-imobiliaria.module';
import { ViviSessionController } from './infra/http/vivi-session.controller';
import { ViviConversationController } from './infra/http/vivi-conversation.controller';
import { ViviConfigController } from './infra/http/vivi-config.controller';
import { EnableViviOnSessionUseCase } from './application/use-cases/enable-vivi-on-session.use-case';
import { DisableViviOnSessionUseCase } from './application/use-cases/disable-vivi-on-session.use-case';
import { ListViviConversationsUseCase } from './application/use-cases/list-vivi-conversations.use-case';
import { ProcessIncomingMessageUseCase } from './application/use-cases/process-incoming-message.use-case';
import { AgendarVisitaUseCase } from './application/use-cases/agendar-visita.use-case';
import { GetOrCreateViviConfigUseCase } from './application/use-cases/get-or-create-vivi-config.use-case';
import { UpdateViviConfigUseCase } from './application/use-cases/update-vivi-config.use-case';
import { WhatsAppMessageReceivedListener } from './infra/listeners/whatsapp-message-received.listener';
import { PrismaViviConversationRepository } from './infra/database/prisma-vivi-conversation.repository';
import { PrismaViviConfigRepository } from './infra/database/prisma-vivi-config.repository';
import { PrismaEnderecoBuscaLogRepository } from './infra/database/prisma-endereco-busca-log.repository';
import { AnthropicConversationService } from '../../shared/infra/services/anthropic-conversation.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  // Dependencia de modulo (nao circular): vivi_sdr consome use cases ja
  // exportados por whatsappmarketing, vendas_kanban, atendimento (Central
  // de Atendimento - GetOrCreateAtendimentoUseCase/
  // ClassifyAndRouteAtendimentoUseCase, usados pelo listener e pela tool
  // "transferir_para_fila") e gestao_imobiliaria (BuscarEmpreendimentoPorEnderecoUseCase,
  // usado pela tool "buscar_empreendimento_por_endereco" - VIVI Fatia 2). O
  // caminho inverso (esses 4 modulos -> vivi_sdr) nao existe - os
  // providers so emitem eventos genericos, ver
  // infra/listeners/whatsapp-message-received.listener.ts.
  imports: [WhatsAppMarketingModule, VendasKanbanModule, AtendimentoModule, GestaoImobiliariaModule],
  controllers: [ViviSessionController, ViviConversationController, ViviConfigController],
  providers: [
    PrismaService,
    EnableViviOnSessionUseCase,
    DisableViviOnSessionUseCase,
    ListViviConversationsUseCase,
    ProcessIncomingMessageUseCase,
    AgendarVisitaUseCase,
    GetOrCreateViviConfigUseCase,
    UpdateViviConfigUseCase,
    WhatsAppMessageReceivedListener,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / Anthropic).
    { provide: 'IViviConversationRepository', useClass: PrismaViviConversationRepository },
    { provide: 'IViviConfigRepository', useClass: PrismaViviConfigRepository },
    { provide: 'IEnderecoBuscaLogRepository', useClass: PrismaEnderecoBuscaLogRepository },
    { provide: 'IAiConversationService', useClass: AnthropicConversationService },
  ],
})
export class ViviSdrModule {}
