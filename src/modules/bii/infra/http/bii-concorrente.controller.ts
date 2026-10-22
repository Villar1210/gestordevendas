// src/modules/bii/infra/http/bii-concorrente.controller.ts
// Fatia 3 - Concorrentes (cadastro manual, POR TENANT). So Administrador
// (classe), reforcado nos use cases. tenantId/role/usuario/impersonadoPor
// sempre de req.user. Impersonacao do Super Usuario: leitura liberada,
// POST/PATCH/DELETE -> 403 BII_SOMENTE_LEITURA (no use case).
// Contrato: docs/bii/fatia3/CONTRATO_CONCORRENTES.md
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import {
  ConcorrenteEntrada,
  CreateConcorrenteUseCase,
  DeleteConcorrenteUseCase,
  GetConcorrenteUseCase,
  ListConcorrentesUseCase,
  UpdateConcorrenteUseCase,
} from '../../application/use-cases/concorrentes.use-cases';
import { ConcorrenteDto } from './dtos/concorrente.dto';
import { BiiConcorrenteThrottlerGuard } from './bii-concorrente-throttler.guard';
import { LimiteConcorrenciaGuard } from '../../../../shared/infra/http/limite-concorrencia';

// Exportado para o meta-teste. Criar/editar podem geocodificar (fila global
// de 1 req/s): no maximo 2 simultaneas por processo (503 acima disso).
export const BiiConcorrenteLimiteGuard = LimiteConcorrenciaGuard('bii-concorrente', 2);

function entrada(dto: ConcorrenteDto): ConcorrenteEntrada {
  return {
    nome: dto.nome,
    construtora: dto.construtora ?? null,
    endereco: dto.endereco,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    fase: dto.fase,
    dataLancamento: dto.dataLancamento ?? null,
    totalUnidades: dto.totalUnidades ?? null,
    unidadesVendidas: dto.unidadesVendidas ?? null,
    fonte: dto.fonte ?? null,
    fonteUrl: dto.fonteUrl ?? null,
    observacoes: dto.observacoes ?? null,
    tipologias: dto.tipologias.map((t) => ({
      descricao: t.descricao,
      dormitorios: t.dormitorios ?? null,
      areaPrivativa: t.areaPrivativa,
      precoDe: t.precoDe,
      precoAte: t.precoAte ?? null,
    })),
  };
}

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
export class BiiConcorrenteController {
  constructor(
    private readonly listUseCase: ListConcorrentesUseCase,
    private readonly getUseCase: GetConcorrenteUseCase,
    private readonly createUseCase: CreateConcorrenteUseCase,
    private readonly updateUseCase: UpdateConcorrenteUseCase,
    private readonly deleteUseCase: DeleteConcorrenteUseCase,
  ) {}

  @Get('concorrentes')
  async listar(@Req() req: Request) {
    return this.listUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  @Get('concorrentes/:id')
  async abrir(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.getUseCase.execute({ tenantId: req.user!.tenantId, requesterRole: req.user!.role, id });
  }

  // 30/min por IP e 30/min por USUARIO (somando POST/PATCH/DELETE), 2
  // simultaneas e cota diaria de geocodificacao por tenant (no use case).
  @Post('concorrentes')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiConcorrenteThrottlerGuard, BiiConcorrenteLimiteGuard)
  async criar(@Body() dto: ConcorrenteDto, @Req() req: Request) {
    return this.createUseCase.execute({ ...requisitante(req), dados: entrada(dto) });
  }

  @Patch('concorrentes/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiConcorrenteThrottlerGuard, BiiConcorrenteLimiteGuard)
  async atualizar(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ConcorrenteDto, @Req() req: Request) {
    return this.updateUseCase.execute({ ...requisitante(req), id, dados: entrada(dto) });
  }

  @Delete('concorrentes/:id')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(BiiConcorrenteThrottlerGuard)
  async excluir(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.deleteUseCase.execute({ ...requisitante(req), id });
  }
}
