// src/modules/roleta_online/infra/http/roleta.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { UpdateRoletaConfigDto } from './dtos/update-roleta-config.dto';
import { GetRoletaConfigUseCase } from '../../application/use-cases/get-roleta-config.use-case';
import { UpdateRoletaConfigUseCase } from '../../application/use-cases/update-roleta-config.use-case';
import { ConfirmSuggestedOwnerUseCase } from '../../application/use-cases/confirm-suggested-owner.use-case';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class RoletaController {
  constructor(
    private readonly getRoletaConfigUseCase: GetRoletaConfigUseCase,
    private readonly updateRoletaConfigUseCase: UpdateRoletaConfigUseCase,
    private readonly confirmSuggestedOwnerUseCase: ConfirmSuggestedOwnerUseCase,
  ) {}

  // GET /roleta/config - configuracao atual da Roleta Online do tenant
  @Get('roleta/config')
  async getConfig(@Req() req: Request) {
    return this.getRoletaConfigUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /roleta/config - atualiza a configuracao (so Administrador)
  @Patch('roleta/config')
  async updateConfig(@Body() dto: UpdateRoletaConfigDto, @Req() req: Request) {
    return this.updateRoletaConfigUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      algoritmo: dto.algoritmo,
      modo: dto.modo,
      ativa: dto.ativa,
    });
  }

  // POST /cards/:id/confirmar-sugestao - confirma a sugestao da Roleta
  // (modo semi_automatico); so o proprio corretor sugerido ou um Administrador.
  @Post('cards/:id/confirmar-sugestao')
  async confirmSuggestion(@Param('id') id: string, @Req() req: Request) {
    return this.confirmSuggestedOwnerUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
      requesterRole: req.user!.role,
    });
  }
}
