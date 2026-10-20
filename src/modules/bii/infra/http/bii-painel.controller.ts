// src/modules/bii/infra/http/bii-painel.controller.ts
// BII - so Administrador (classe), reforcado no use case. tenantId sempre de
// req.user. Impersonacao do Super Usuario permitida (rota so de leitura).
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LimiteConcorrenciaGuard } from '../../../../shared/infra/http/limite-concorrencia';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';
import { GetPainelVendasUseCase } from '../../application/use-cases/get-painel-vendas.use-case';
import { GetPainelVendasDto } from './dtos/get-painel-vendas.dto';

// Exportado para o meta-teste de permissoes reconhecer este guard (aditivo,
// nao substitui os guards da classe).
export const BiiPainelLimiteGuard = LimiteConcorrenciaGuard('bii-painel', 2);

@Controller('bii')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class BiiPainelController {
  constructor(private readonly getPainelVendasUseCase: GetPainelVendasUseCase) {}

  // GET /bii/painel?de=YYYY-MM-DD&ate=YYYY-MM-DD&pipelineId=&corretorId=&origem=
  // Calculo em memoria (revisao de seguranca da Fatia 1): no maximo 2 paineis
  // simultaneos por processo (503 acima disso) e 20/min por IP, para um admin
  // clicando "Aplicar" em sequencia nao derrubar o processo. Pendencia: levar
  // a agregacao para o banco antes de tenants grandes.
  @Get('painel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(BiiPainelLimiteGuard)
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
