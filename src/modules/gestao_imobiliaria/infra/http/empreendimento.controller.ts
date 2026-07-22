// src/modules/gestao_imobiliaria/infra/http/empreendimento.controller.ts
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateEmpreendimentoDto } from './dtos/create-empreendimento.dto';
import { GerarLoteImoveisDto } from './dtos/gerar-lote-imoveis.dto';
import { CriarImoveisLoteDto } from './dtos/criar-imoveis-lote.dto';
import { CreateEmpreendimentoUseCase } from '../../application/use-cases/create-empreendimento.use-case';
import { ListEmpreendimentosUseCase } from '../../application/use-cases/list-empreendimentos.use-case';
import { GerarLoteImoveisUseCase } from '../../application/use-cases/gerar-lote-imoveis.use-case';
import { CriarImoveisLoteUseCase } from '../../application/use-cases/criar-imoveis-lote.use-case';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';

@Controller('empreendimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class EmpreendimentoController {
  constructor(
    private readonly createEmpreendimentoUseCase: CreateEmpreendimentoUseCase,
    private readonly listEmpreendimentosUseCase: ListEmpreendimentosUseCase,
    private readonly gerarLoteImoveisUseCase: GerarLoteImoveisUseCase,
    private readonly criarImoveisLoteUseCase: CriarImoveisLoteUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateEmpreendimentoDto, @Req() req: Request) {
    return this.createEmpreendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      name: dto.name,
      rua: dto.rua,
      numero: dto.numero,
      bairro: dto.bairro,
      cidade: dto.cidade,
      uf: dto.uf,
      cep: dto.cep,
      description: dto.description,
    });
  }

  @Get()
  async list(@Req() req: Request) {
    return this.listEmpreendimentosUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/gerar-lote - gera a
  // lista de unidades em memoria (nao persiste nada). O frontend (fatia
  // seguinte) exibe essa lista num grid editavel antes de confirmar.
  @Post(':empreendimentoId/imoveis/gerar-lote')
  async gerarLoteImoveis(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: GerarLoteImoveisDto,
    @Req() req: Request,
  ) {
    return this.gerarLoteImoveisUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      padrao: {
        bloco: dto.bloco,
        andarInicial: dto.andarInicial,
        andarFinal: dto.andarFinal,
        unidadesPorAndar: dto.unidadesPorAndar,
      },
    });
  }

  // POST /empreendimentos/:empreendimentoId/imoveis/lote - persiste a lista
  // ja revisada/editada pelo usuario, tudo em uma unica transacao.
  @Post(':empreendimentoId/imoveis/lote')
  async criarImoveisLote(
    @Param('empreendimentoId') empreendimentoId: string,
    @Body() dto: CriarImoveisLoteDto,
    @Req() req: Request,
  ) {
    const imoveis = await this.criarImoveisLoteUseCase.execute({
      tenantId: req.user!.tenantId,
      empreendimentoId,
      imoveis: dto.imoveis.map((imovel) => ({
        ...imovel,
        disponivelApartirDe: imovel.disponivelApartirDe
          ? parseDateOnly(imovel.disponivelApartirDe)
          : undefined,
      })),
    });
    return { imoveis };
  }
}
