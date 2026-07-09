// src/modules/vivi_sdr/infra/http/vivi-session.controller.ts
import { Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { EnableViviOnSessionUseCase } from '../../application/use-cases/enable-vivi-on-session.use-case';
import { DisableViviOnSessionUseCase } from '../../application/use-cases/disable-vivi-on-session.use-case';

@Controller('whatsapp/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class ViviSessionController {
  constructor(
    private readonly enableViviOnSessionUseCase: EnableViviOnSessionUseCase,
    private readonly disableViviOnSessionUseCase: DisableViviOnSessionUseCase,
  ) {}

  // POST /whatsapp/sessions/:id/vivi/enable - ativa a VIVI nesta sessao
  @Post(':id/vivi/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id') id: string, @Req() req: Request) {
    await this.enableViviOnSessionUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
    });
    return { message: 'VIVI ativada nesta sessao.' };
  }

  // POST /whatsapp/sessions/:id/vivi/disable - desativa a VIVI nesta sessao
  @Post(':id/vivi/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id') id: string, @Req() req: Request) {
    await this.disableViviOnSessionUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
    });
    return { message: 'VIVI desativada nesta sessao.' };
  }
}
