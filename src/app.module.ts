// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { WhatsAppMarketingModule } from './modules/whatsappmarketing/whatsapp-marketing.module';
import { VendasKanbanModule } from './modules/vendas_kanban/vendas-kanban.module';
import { GestaoImobiliariaModule } from './modules/gestao_imobiliaria/gestao-imobiliaria.module';
import { ViviSdrModule } from './modules/vivi_sdr/vivi-sdr.module';
import { RhModule } from './modules/rh/rh.module';
import { RoletaOnlineModule } from './modules/roleta_online/roleta-online.module';
import { EdocModule } from './modules/edoc/edoc.module';
import { PortalClienteModule } from './modules/portal_cliente/portal-cliente.module';
import { PrismaService } from './config/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Le o .env uma unica vez para todo o app
    // Desacopla whatsappmarketing e vivi_sdr: o provider so emite o evento
    // 'whatsapp.message.received', sem conhecer quem escuta (ver CLAUDE.md).
    EventEmitterModule.forRoot(),
    AuthModule,
    WhatsAppMarketingModule,
    VendasKanbanModule,
    GestaoImobiliariaModule,
    ViviSdrModule,
    RhModule,
    RoletaOnlineModule,
    EdocModule,
    PortalClienteModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
