// src/modules/vivi_sdr/infra/http/vivi-config.controller.ts
// Aba "Configuracoes da VIVI" (Painel de Configuracao) - preco minimo,
// faixas de renda e detalhes de negocio por faixa, dados sensiveis de
// negocio (so Administrador).
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
      limiteFaixa1: dto.limiteFaixa1,
      limiteFaixa2: dto.limiteFaixa2,
      limiteFaixa3: dto.limiteFaixa3,
      limiteFaixa4: dto.limiteFaixa4,
      faixa1SubsidioMax: dto.faixa1SubsidioMax ?? null,
      faixa1JurosMin: dto.faixa1JurosMin ?? null,
      faixa1JurosMax: dto.faixa1JurosMax ?? null,
      faixa1TetoFinanciamento: dto.faixa1TetoFinanciamento ?? null,
      faixa1ExemploParcela: dto.faixa1ExemploParcela ?? null,
      faixa2SubsidioMax: dto.faixa2SubsidioMax ?? null,
      faixa2JurosMin: dto.faixa2JurosMin ?? null,
      faixa2JurosMax: dto.faixa2JurosMax ?? null,
      faixa2TetoFinanciamento: dto.faixa2TetoFinanciamento ?? null,
      faixa2ExemploParcela: dto.faixa2ExemploParcela ?? null,
      faixa3SubsidioMax: dto.faixa3SubsidioMax ?? null,
      faixa3JurosMin: dto.faixa3JurosMin ?? null,
      faixa3JurosMax: dto.faixa3JurosMax ?? null,
      faixa3TetoFinanciamento: dto.faixa3TetoFinanciamento ?? null,
      faixa3ExemploParcela: dto.faixa3ExemploParcela ?? null,
      faixa4SubsidioMax: dto.faixa4SubsidioMax ?? null,
      faixa4JurosMin: dto.faixa4JurosMin ?? null,
      faixa4JurosMax: dto.faixa4JurosMax ?? null,
      faixa4TetoFinanciamento: dto.faixa4TetoFinanciamento ?? null,
      faixa4ExemploParcela: dto.faixa4ExemploParcela ?? null,
      diasParaRotting: dto.diasParaRotting ?? undefined,
      ativaRotatingIndicador: dto.ativaRotatingIndicador ?? undefined,
      sobreConstrutora: dto.sobreConstrutora ?? null,
      diferenciaisConstrutora: dto.diferenciaisConstrutora ?? null,
    });
  }
}
