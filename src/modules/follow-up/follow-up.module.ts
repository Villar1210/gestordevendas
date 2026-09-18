import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { FollowUpService } from './follow-up.service';
import { PrismaService } from '../../config/prisma.service';
import { ViviIntegrationModule } from '../vivi-integration/vivi-integration.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    ViviIntegrationModule,
  ],
  providers: [PrismaService, FollowUpService],
})
export class FollowUpModule {}
