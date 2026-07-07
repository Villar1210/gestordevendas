// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { WhatsAppMarketingModule } from './modules/whatsappmarketing/whatsapp-marketing.module';
import { VendasKanbanModule } from './modules/vendas_kanban/vendas-kanban.module';
import { GestaoImobiliariaModule } from './modules/gestao_imobiliaria/gestao-imobiliaria.module';
import { PrismaService } from './config/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Le o .env uma unica vez para todo o app
    AuthModule,
    WhatsAppMarketingModule,
    VendasKanbanModule,
    GestaoImobiliariaModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
