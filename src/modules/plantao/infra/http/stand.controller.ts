// src/modules/plantao/infra/http/stand.controller.ts
// Modulo Plantao/Stand - so Administrador gerencia (criar/editar/excluir
// stands e definir a escala), decisao confirmada com o usuario antes de
// implementar.
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { CreateStandDto } from './dtos/create-stand.dto';
import { UpdateStandDto } from './dtos/update-stand.dto';
import { SetEscalaDto } from './dtos/set-escala.dto';
import { CreateStandUseCase } from '../../application/use-cases/create-stand.use-case';
import { ListStandsUseCase } from '../../application/use-cases/list-stands.use-case';
import { UpdateStandUseCase } from '../../application/use-cases/update-stand.use-case';
import { DeleteStandUseCase } from '../../application/use-cases/delete-stand.use-case';
import { SetEscalaUseCase } from '../../application/use-cases/set-escala.use-case';
import { RemoveEscalaUseCase } from '../../application/use-cases/remove-escala.use-case';
import { ListEscalasByStandUseCase } from '../../application/use-cases/list-escalas-by-stand.use-case';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class StandController {
  constructor(
    private readonly createStandUseCase: CreateStandUseCase,
    private readonly listStandsUseCase: ListStandsUseCase,
    private readonly updateStandUseCase: UpdateStandUseCase,
    private readonly deleteStandUseCase: DeleteStandUseCase,
    private readonly setEscalaUseCase: SetEscalaUseCase,
    private readonly removeEscalaUseCase: RemoveEscalaUseCase,
    private readonly listEscalasByStandUseCase: ListEscalasByStandUseCase,
  ) {}

  // POST /stands - cria um novo stand
  @Post('stands')
  async create(@Body() dto: CreateStandDto, @Req() req: Request) {
    return this.createStandUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      nome: dto.nome,
      endereco: dto.endereco,
    });
  }

  // GET /stands - lista os stands do tenant
  @Get('stands')
  async list(@Req() req: Request) {
    return this.listStandsUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // PATCH /stands/:id - edita nome/endereco/ativo
  @Patch('stands/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateStandDto, @Req() req: Request) {
    return this.updateStandUseCase.execute({
      standId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      nome: dto.nome,
      endereco: dto.endereco,
      ativo: dto.ativo,
    });
  }

  // DELETE /stands/:id - remove um stand (bloqueado se tiver escala ou Coordenador vinculado)
  @Delete('stands/:id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.deleteStandUseCase.execute({
      standId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
    return { message: 'Stand removido com sucesso.' };
  }

  // GET /stands/:id/escalas - grade semanal completa do stand
  @Get('stands/:id/escalas')
  async listEscalas(@Param('id') id: string, @Req() req: Request) {
    return this.listEscalasByStandUseCase.execute({
      standId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // POST /stands/:id/escalas - define um corretor num dia da semana (idempotente)
  @Post('stands/:id/escalas')
  async setEscala(@Param('id') id: string, @Body() dto: SetEscalaDto, @Req() req: Request) {
    return this.setEscalaUseCase.execute({
      standId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      userId: dto.userId,
      diaSemana: dto.diaSemana,
    });
  }

  // DELETE /escalas/:id - remove uma linha de escala
  @Delete('escalas/:id')
  async removeEscala(@Param('id') id: string, @Req() req: Request) {
    await this.removeEscalaUseCase.execute({
      escalaId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
    return { message: 'Escala removida com sucesso.' };
  }
}
