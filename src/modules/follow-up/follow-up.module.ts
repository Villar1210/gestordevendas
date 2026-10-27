import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FollowUpService } from './follow-up.service';
import { PrismaService } from '../../config/prisma.service';
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';
import { AlertasGestaoWhatsappListener } from './alertas-gestao-whatsapp.listener';

@Module({
  imports: [ConfigModule],
  providers: [PrismaService, ChatwootWhatsappService, FollowUpService, AlertasGestaoWhatsappListener],
  exports: [FollowUpService],
})
export class FollowUpModule {}
