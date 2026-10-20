// src/modules/bii/infra/http/bii-analise.controller.ts
// Fatia 2 - Analise por Endereco (tenant). So Administrador (classe), reforcado
// nos use cases. tenantId/role/usuario sempre de req.user. Impersonacao do
// Super Usuario: e Administrador do tenant, pode analisar (consome
// geocodificacao, dentro do throttle) - fica registrado em
// BiiAnalise.impersonadoPor e no log.
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

  // POST /bii/analises/endereco - 10/min por IP, no maximo 2 simultaneas por
  // processo (503 acima disso).
  @Post('analises/endereco')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(BiiAnaliseLimiteGuard)
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
