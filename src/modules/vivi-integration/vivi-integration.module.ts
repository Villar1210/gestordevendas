import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ViviIntegrationController } from './infra/http/vivi-integration.controller';
import { ChatwootWhatsappService } from './services/chatwoot-whatsapp.service';
import { ViviSdrModule } from '../vivi_sdr/vivi-sdr.module';
import { PrismaService } from '../../config/prisma.service';
import { FollowUpModule } from '../follow-up/follow-up.module';

@Module({
  imports: [
    ConfigModule,
    ViviSdrModule,
    FollowUpModule,
  ],
  controllers: [ViviIntegrationController],
  providers: [PrismaService, ChatwootWhatsappService],
  exports: [ChatwootWhatsappService],
})
export class ViviIntegrationModule {}
