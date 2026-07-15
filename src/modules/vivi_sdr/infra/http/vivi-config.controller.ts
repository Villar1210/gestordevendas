// src/modules/vivi_sdr/infra/http/vivi-config.controller.ts
// Aba "Configuracoes da VIVI" do Painel Administrativo - preco minimo e
// faixas de renda, dados sensiveis de negocio (so Administrador).
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { UpdateViviConfigDto } from './dtos/update-vivi-config.dto';
import { GetOrCreateViviConfigUseCase } from '../../application/use-cases/get-or-create-vivi-config.use-case';
import { UpdateViviConfigUseCase } from '../../application/use-cases/update-vivi-config.use-case';

@Controller('vivi/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class ViviConfigController {
  constructor(
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
    private readonly updateViviConfigUseCase: UpdateViviConfigUseCase,
  ) {}

  // GET /vivi/config - preco minimo + faixas de renda atuais do tenant
  // (cria automaticamente com os defaults na primeira vez).
  @Get()
  async get(@Req() req: Request) {
    return this.getOrCreateViviConfigUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /vivi/config - Administrador edita os valores.
  @Patch()
  async update(@Body() dto: UpdateViviConfigDto, @Req() req: Request) {
    return this.updateViviConfigUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      precoMinimo: dto.precoMinimo,
      limiteSemPerfil: dto.limiteSemPerfil,
      limiteHis1: dto.limiteHis1,
      limiteHis2: dto.limiteHis2,
      limiteHmp: dto.limiteHmp,
    });
  }
}
