// src/modules/bii/infra/http/bii-analise.controller.ts
// Fatia 2 - Analise por Endereco (tenant). So Administrador (classe), reforcado
// nos use cases. tenantId/role/usuario sempre de req.user. Impersonacao do
// Super Usuario (decisao do Villar na Fase 1): BII SOMENTE LEITURA - pode ver
// painel, listar/abrir analises e cobertura; criar analise -> 403
// BII_SOMENTE_LEITURA (checado no use case).
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LimiteConcorrenciaGuard } from '../../../../shared/infra/http/limite-concorrencia';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { AnalisarEnderecoUseCase } from '../../application/use-cases/analisar-endereco.use-case';
import { GetAnaliseUseCase, ListAnalisesUseCase } from '../../application/use-cases/analises-salvas.use-case';
import { GetItbiCoberturaUseCase } from '../../application/use-cases/itbi-cobertura.use-case';
import { AnalisarEnderecoDto } from './dtos/analisar-endereco.dto';
import { BiiAnaliseThrottlerGuard } from './bii-analise-throttler.guard';

// Exportado para o meta-teste de permissoes (aditivo aos guards da classe).
export const BiiAnaliseLimiteGuard = LimiteConcorrenciaGuard('bii-analise', 2);

@Controller('bii')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class BiiAnaliseController {
  constructor(
    private readonly analisarEnderecoUseCase: AnalisarEnderecoUseCase,
    private readonly listAnalisesUseCase: ListAnalisesUseCase,
    private readonly getAnaliseUseCase: GetAnaliseUseCase,
    private readonly getItbiCoberturaUseCase: GetItbiCoberturaUseCase,
  ) {}

  // POST /bii/analises/endereco - 10/min por IP e 10/min por USUARIO, no
  // maximo 2 simultaneas por processo (503 acima disso) e cota diaria por
  // tenant (429 BII_COTA_DIARIA, no use case). Impersonacao: 403
  // BII_SOMENTE_LEITURA (no use case).
  @Post('analises/endereco')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(BiiAnaliseThrottlerGuard, BiiAnaliseLimiteGuard)
  async analisar(@Body() dto: AnalisarEnderecoDto, @Req() req: Request) {
    return this.analisarEnderecoUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      impersonadoPor: req.user!.impersonadoPor ?? null,
      endereco: dto.endereco,
      raioMetros: dto.raioMetros,
      meses: dto.meses,
      areaMin: dto.areaMin ?? null,
      areaMax: dto.areaMax ?? null,
      tipo: dto.tipo,
      somenteCompraVenda: dto.somenteCompraVenda,
    });
  }

  @Get('analises')
  async listar(@Req() req: Request) {
    return this.listAnalisesUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  @Get('analises/:id')
  async abrir(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.getAnaliseUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role, id });
  }

  @Get('itbi/cobertura')
  async cobertura(@Req() req: Request) {
    return this.getItbiCoberturaUseCase.execute({ requesterRole: req.user!.role });
  }
}
