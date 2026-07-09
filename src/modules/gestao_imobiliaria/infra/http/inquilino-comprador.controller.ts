// src/modules/gestao_imobiliaria/infra/http/inquilino-comprador.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateInquilinoCompradorDto } from './dtos/create-inquilino-comprador.dto';
import { CreateInquilinoCompradorUseCase } from '../../application/use-cases/create-inquilino-comprador.use-case';
import { ListInquilinosCompradoresUseCase } from '../../application/use-cases/list-inquilinos-compradores.use-case';

@Controller('inquilinos-compradores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class InquilinoCompradorController {
  constructor(
    private readonly createInquilinoCompradorUseCase: CreateInquilinoCompradorUseCase,
    private readonly listInquilinosCompradoresUseCase: ListInquilinosCompradoresUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateInquilinoCompradorDto, @Req() req: Request) {
    return this.createInquilinoCompradorUseCase.execute({
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Get()
  async list(@Req() req: Request) {
    return this.listInquilinosCompradoresUseCase.execute(req.user!.tenantId);
  }
}
