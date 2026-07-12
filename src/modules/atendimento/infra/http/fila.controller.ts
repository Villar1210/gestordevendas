// src/modules/atendimento/infra/http/fila.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateFilaDto } from './dtos/create-fila.dto';
import { AddUsuarioToFilaDto } from './dtos/add-usuario-to-fila.dto';
import { CreateFilaUseCase } from '../../application/use-cases/create-fila.use-case';
import { ListFilasUseCase } from '../../application/use-cases/list-filas.use-case';
import { AddUsuarioToFilaUseCase } from '../../application/use-cases/add-usuario-to-fila.use-case';
import { RemoveUsuarioFromFilaUseCase } from '../../application/use-cases/remove-usuario-from-fila.use-case';

@Controller('filas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class FilaController {
  constructor(
    private readonly createFilaUseCase: CreateFilaUseCase,
    private readonly listFilasUseCase: ListFilasUseCase,
    private readonly addUsuarioToFilaUseCase: AddUsuarioToFilaUseCase,
    private readonly removeUsuarioFromFilaUseCase: RemoveUsuarioFromFilaUseCase,
  ) {}

  // POST /filas - so Administrador gerencia filas
  @Post()
  @Roles('Administrador')
  async create(@Body() dto: CreateFilaDto, @Req() req: Request) {
    return this.createFilaUseCase.execute({
      tenantId: req.user!.tenantId,
      nome: dto.nome,
      descricao: dto.descricao,
    });
  }

  // GET /filas - qualquer role do dashboard (usado nos filtros da Central de Atendimento)
  @Get()
  async list(@Req() req: Request) {
    return this.listFilasUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // POST /filas/:id/usuarios - so Administrador vincula agentes
  @Post(':id/usuarios')
  @Roles('Administrador')
  async addUsuario(
    @Param('id') filaId: string,
    @Body() dto: AddUsuarioToFilaDto,
    @Req() req: Request,
  ) {
    await this.addUsuarioToFilaUseCase.execute({
      tenantId: req.user!.tenantId,
      filaId,
      userId: dto.userId,
    });
    return { ok: true };
  }

  // DELETE /filas/:id/usuarios/:userId - so Administrador desvincula agentes
  @Delete(':id/usuarios/:userId')
  @Roles('Administrador')
  async removeUsuario(
    @Param('id') filaId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    await this.removeUsuarioFromFilaUseCase.execute({
      tenantId: req.user!.tenantId,
      filaId,
      userId,
    });
    return { ok: true };
  }
}
