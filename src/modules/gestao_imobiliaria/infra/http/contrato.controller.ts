// src/modules/gestao_imobiliaria/infra/http/contrato.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateContratoDto } from './dtos/create-contrato.dto';
import { ListContratosQueryDto } from './dtos/list-contratos-query.dto';
import { CreateContratoUseCase } from '../../application/use-cases/create-contrato.use-case';
import { ListContratosUseCase } from '../../application/use-cases/list-contratos.use-case';
import { GetContratoUseCase } from '../../application/use-cases/get-contrato.use-case';
import { EncerrarContratoUseCase } from '../../application/use-cases/encerrar-contrato.use-case';

@Controller('contratos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class ContratoController {
  constructor(
    private readonly createContratoUseCase: CreateContratoUseCase,
    private readonly listContratosUseCase: ListContratosUseCase,
    private readonly getContratoUseCase: GetContratoUseCase,
    private readonly encerrarContratoUseCase: EncerrarContratoUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateContratoDto, @Req() req: Request) {
    return this.createContratoUseCase.execute({
      tenantId: req.user!.tenantId,
      imovelId: dto.imovelId,
      proprietarioId: dto.proprietarioId,
      proprietario: dto.proprietario,
      inquilinoCompradorId: dto.inquilinoCompradorId,
      inquilinoComprador: dto.inquilinoComprador,
      tipo: dto.tipo,
      valor: dto.valor,
      dataInicio: new Date(dto.dataInicio),
      dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
      diaVencimento: dto.diaVencimento,
    });
  }

  @Get()
  async list(@Query() query: ListContratosQueryDto, @Req() req: Request) {
    return this.listContratosUseCase.execute({
      tenantId: req.user!.tenantId,
      tipo: query.tipo,
      status: query.status,
      imovelId: query.imovelId,
      proprietarioId: query.proprietarioId,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.getContratoUseCase.execute({ contratoId: id, tenantId: req.user!.tenantId });
  }

  @Post(':id/encerrar')
  @HttpCode(HttpStatus.OK)
  async encerrar(@Param('id') id: string, @Req() req: Request) {
    return this.encerrarContratoUseCase.execute({
      contratoId: id,
      tenantId: req.user!.tenantId,
    });
  }
}
