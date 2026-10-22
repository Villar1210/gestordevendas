// src/modules/bii/infra/http/bii-viabilidade.controller.ts
// Fatia 4 - Viabilidade HIS/HMP/MCMV. So Administrador (classe), reforcado
// nos use cases. So calculo (sem banco, sem servico externo): liberado na
// impersonacao do Super Usuario. Contrato: docs/bii/fatia4/CONTRATO_VIABILIDADE.md
import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { CalcularViabilidadeUseCase, GetParametrosViabilidadeUseCase } from '../../application/use-cases/viabilidade.use-cases';
import { CalcularViabilidadeDto } from './dtos/viabilidade.dto';

@Controller('bii')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class BiiViabilidadeController {
  constructor(
    private readonly parametrosUseCase: GetParametrosViabilidadeUseCase,
    private readonly calcularUseCase: CalcularViabilidadeUseCase,
  ) {}

  @Get('viabilidade/parametros')
  parametros(@Req() req: Request) {
    return this.parametrosUseCase.execute({ requesterRole: req.user!.role });
  }

  @Post('viabilidade')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  calcular(@Body() dto: CalcularViabilidadeDto, @Req() req: Request) {
    return this.calcularUseCase.execute({
      requesterRole: req.user!.role,
      tipologias: dto.tipologias.map((t) => ({ descricao: t.descricao, areaPrivativa: t.areaPrivativa, preco: t.preco })),
      premissas: dto.premissas
        ? {
            entradaPercentual: dto.premissas.entradaPercentual,
            prazoMeses: dto.premissas.prazoMeses,
            comprometimentoPercentual: dto.premissas.comprometimentoPercentual,
            jurosAnual: dto.premissas.jurosAnual ?? null,
          }
        : undefined,
    });
  }
}
