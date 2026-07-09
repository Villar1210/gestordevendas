// src/modules/gestao_imobiliaria/infra/http/proprietario.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateProprietarioDto } from './dtos/create-proprietario.dto';
import { UpdateProprietarioDto } from './dtos/update-proprietario.dto';
import { CreateProprietarioUseCase } from '../../application/use-cases/create-proprietario.use-case';
import { ListProprietariosUseCase } from '../../application/use-cases/list-proprietarios.use-case';
import { UpdateProprietarioUseCase } from '../../application/use-cases/update-proprietario.use-case';

@Controller('proprietarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class ProprietarioController {
  constructor(
    private readonly createProprietarioUseCase: CreateProprietarioUseCase,
    private readonly listProprietariosUseCase: ListProprietariosUseCase,
    private readonly updateProprietarioUseCase: UpdateProprietarioUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateProprietarioDto, @Req() req: Request) {
    return this.createProprietarioUseCase.execute({
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Get()
  async list(@Req() req: Request) {
    return this.listProprietariosUseCase.execute(req.user!.tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProprietarioDto,
    @Req() req: Request,
  ) {
    return this.updateProprietarioUseCase.execute({
      proprietarioId: id,
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }
}
