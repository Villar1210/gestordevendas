// src/modules/bii/infra/http/bii-painel.controller.ts
// BII - so Administrador (classe), reforcado no use case. tenantId sempre de
// req.user. Impersonacao do Super Usuario permitida (rota so de leitura).
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';
import { GetPainelVendasUseCase } from '../../application/use-cases/get-painel-vendas.use-case';
import { GetPainelVendasDto } from './dtos/get-painel-vendas.dto';

@Controller('bii')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class BiiPainelController {
  constructor(private readonly getPainelVendasUseCase: GetPainelVendasUseCase) {}

  // GET /bii/painel?de=YYYY-MM-DD&ate=YYYY-MM-DD&pipelineId=&corretorId=&origem=
  @Get('painel')
  async painel(@Query() dto: GetPainelVendasDto, @Req() req: Request) {
    return this.getPainelVendasUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      de: dto.de ? parseDateOnly(dto.de) : undefined,
      ate: dto.ate ? parseDateOnly(dto.ate) : undefined,
      pipelineId: dto.pipelineId,
      corretorId: dto.corretorId,
      origem: dto.origem,
    });
  }
}
