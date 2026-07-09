// src/modules/vivi_sdr/infra/http/vivi-conversation.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { ListViviConversationsUseCase } from '../../application/use-cases/list-vivi-conversations.use-case';

@Controller('vivi/conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class ViviConversationController {
  constructor(private readonly listViviConversationsUseCase: ListViviConversationsUseCase) {}

  // GET /vivi/conversations - lista simples, para debug/visibilidade
  @Get()
  async list(@Req() req: Request) {
    return this.listViviConversationsUseCase.execute(req.user!.tenantId);
  }
}
