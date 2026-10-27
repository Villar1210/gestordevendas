// src/modules/bii/infra/http/bii-estudo.controller.ts
// Fatia 5 - Estudo de terreno (POR TENANT). So Administrador (classe),
// reforcado nos use cases. tenantId/role/usuario/impersonadoPor sempre de
// req.user. Impersonacao do Super Usuario: GET liberado; POST/PATCH/DELETE ->
// 403 BII_SOMENTE_LEITURA (no use case). Nao geocodifica nem le ITBI.
// Contrato: docs/bii/fatia5/CONTRATO_ESTUDO.md
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import {
  AtualizarEstudoUseCase,
  CriarEstudoUseCase,
  ExcluirEstudoUseCase,
  GetEstudoUseCase,
  ListEstudosUseCase,
} from '../../application/use-cases/estudos.use-cases';
import { AtualizarEstudoDto, CriarEstudoDto } from './dtos/estudo.dto';
import { premissasFinanceirasDoDto } from './dtos/viabilidade.dto';
import { BiiEstudoThrottlerGuard } from './bii-estudo-throttler.guard';

function requisitante(req: Request) {
  return {
    tenantId: req.user!.tenantId,
    requesterRole: req.user!.role,
    requesterUserId: req.user!.id,
    impersonadoPor: req.user!.impersonadoPor ?? null,
  };
}

@Controller('bii')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class BiiEstudoController {
  constructor(
    private readonly listUseCase: ListEstudosUseCase,
    private readonly getUseCase: GetEstudoUseCase,
    private readonly criarUseCase: CriarEstudoUseCase,
    private readonly atualizarUseCase: AtualizarEstudoUseCase,
    private readonly excluirUseCase: ExcluirEstudoUseCase,
  ) {}

  @Get('estudos')
  async listar(@Req() req: Request) {
    return this.listUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  @Get('estudos/:id')
  async abrir(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.getUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role, id });
  }

  // Escrita: 30/min por IP e 30/min por USUARIO somando POST/PATCH/DELETE.
  @Post('estudos')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiEstudoThrottlerGuard)
  async criar(@Body() dto: CriarEstudoDto, @Req() req: Request) {
    return this.criarUseCase.execute({
      ...requisitante(req),
      analiseId: dto.analiseId,
      nome: dto.nome,
      conclusao: dto.conclusao ?? null,
      tipologias: dto.tipologias.map((t) => ({ descricao: t.descricao, areaPrivativa: t.areaPrivativa, preco: t.preco, quantidade: t.quantidade })),
      premissas: dto.premissas
        ? {
            entradaPercentual: dto.premissas.entradaPercentual,
            prazoMeses: dto.premissas.prazoMeses,
            comprometimentoPercentual: dto.premissas.comprometimentoPercentual,
            jurosAnual: dto.premissas.jurosAnual ?? null,
          }
        : undefined,
      financeiro: dto.financeiro ? premissasFinanceirasDoDto(dto.financeiro) : undefined,
    });
  }

  @Patch('estudos/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiEstudoThrottlerGuard)
  async atualizar(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarEstudoDto, @Req() req: Request) {
    return this.atualizarUseCase.execute({ ...requisitante(req), id, nome: dto.nome, conclusao: dto.conclusao });
  }

  @Delete('estudos/:id')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiEstudoThrottlerGuard)
  async excluir(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.excluirUseCase.execute({ ...requisitante(req), id });
  }
}
