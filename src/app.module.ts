// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { WhatsAppMarketingModule } from './modules/whatsappmarketing/whatsapp-marketing.module';
import { VendasKanbanModule } from './modules/vendas_kanban/vendas-kanban.module';
import { GestaoImobiliariaModule } from './modules/gestao_imobiliaria/gestao-imobiliaria.module';
import { ViviSdrModule } from './modules/vivi_sdr/vivi-sdr.module';
import { RhModule } from './modules/rh/rh.module';
import { RoletaOnlineModule } from './modules/roleta_online/roleta-online.module';
import { EdocModule } from './modules/edoc/edoc.module';
import { PortalClienteModule } from './modules/portal_cliente/portal-cliente.module';
import { AtendimentoModule } from './modules/atendimento/atendimento.module';
import { ConfiguracoesModule } from './modules/configuracoes/configuracoes.module';
import { PrismaService } from './config/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Le o .env uma unica vez para todo o app
    // Desacopla whatsappmarketing e vivi_sdr: o provider so emite o evento
    // 'whatsapp.message.received', sem conhecer quem escuta (ver CLAUDE.md).
    EventEmitterModule.forRoot(),
    // Rate limiting global (100 req/min por IP). O login (POST /auth/login)
    // sobrescreve esse limite para 5/15min via @Throttle na propria rota -
    // um so throttler nomeado "default", nao dois, para o override por
    // decorator funcionar (ver auth.controller.ts).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    WhatsAppMarketingModule,
    VendasKanbanModule,
    GestaoImobiliariaModule,
    ViviSdrModule,
    RhModule,
    RoletaOnlineModule,
    EdocModule,
    PortalClienteModule,
    AtendimentoModule,
    ConfiguracoesModule,
  ],
  providers: [PrismaService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [PrismaService],
})
export class AppModule {}
