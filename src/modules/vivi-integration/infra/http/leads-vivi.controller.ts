// src/modules/vivi-integration/infra/http/leads-vivi.controller.ts
// Fatia 3 (WhatsApp do corretor) - rotas logadas (JWT), diferente do
// ViviIntegrationController (chamado pela VIVI com API key).
import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { LeadsViviUseCases, Solicitante } from '../../application/use-cases/leads-vivi.use-cases';

const UUID = /^[0-9a-f-]{36}$/i;

@Controller('leads-vivi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class LeadsViviController {
  constructor(private readonly useCases: LeadsViviUseCases) {}

  private solicitante(req: Request): Solicitante {
    return { tenantId: req.user!.tenantId, userId: req.user!.id, role: req.user!.role, cargo: req.user!.cargo ?? null };
  }

  // GET /leads-vivi?corretorId= - leads da VIVI (meus; ou todos p/ quem ve todos)
  @Get()
  async listar(@Req() req: Request, @Query('corretorId') corretorId?: string) {
    return this.useCases.listar(this.solicitante(req), corretorId && UUID.test(corretorId) ? corretorId : undefined);
  }

  // GET /leads-vivi/:cardId/conversa - conversa da VIVI com o cliente (so leitura)
  @Get(':cardId/conversa')
  async conversa(@Param('cardId', ParseUUIDPipe) cardId: string, @Req() req: Request) {
    return this.useCases.conversa(this.solicitante(req), cardId);
  }

  // POST /leads-vivi/:cardId/contato - registra que o corretor abriu o WhatsApp com o cliente
  @Post(':cardId/contato')
  async registrarContato(@Param('cardId', ParseUUIDPipe) cardId: string, @Req() req: Request) {
    return this.useCases.registrarContato(this.solicitante(req), cardId);
  }
}
