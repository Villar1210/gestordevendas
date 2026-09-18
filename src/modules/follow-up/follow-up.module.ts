import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FollowUpService } from './follow-up.service';
import { PrismaService } from '../../config/prisma.service';
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';

@Module({
  imports: [ConfigModule],
  providers: [PrismaService, ChatwootWhatsappService, FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
