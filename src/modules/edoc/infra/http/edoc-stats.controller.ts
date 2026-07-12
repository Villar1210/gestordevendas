// src/modules/edoc/infra/http/edoc-stats.controller.ts
// Controller proprio (nao aninhado em EnvelopeController, que ja usa
// @Controller('edoc/envelopes')) - GET /edoc/stats e uma rota irma de
// /edoc/envelopes/*, nao um recurso dentro dela.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { GetEnvelopeStatsUseCase } from '../../application/use-cases/get-envelope-stats.use-case';

@Controller('edoc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class EdocStatsController {
  constructor(private readonly getEnvelopeStatsUseCase: GetEnvelopeStatsUseCase) {}

  // GET /edoc/stats - contagens do dashboard (total, por status)
  @Get('stats')
  async getStats(@Req() req: Request) {
    return this.getEnvelopeStatsUseCase.execute({ tenantId: req.user!.tenantId });
  }
}
