// src/modules/gestao_imobiliaria/infra/http/financeiro.controller.ts
// Dados financeiros sao sensiveis - so Administrador (mais estrito que
// DASHBOARD_ROLES, usado nos demais controllers deste modulo).
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { CreateLancamentoDto } from './dtos/create-lancamento.dto';
import { ListLancamentosQueryDto } from './dtos/list-lancamentos-query.dto';
import { CreateLancamentoUseCase } from '../../application/use-cases/create-lancamento.use-case';
import { ListLancamentosUseCase } from '../../application/use-cases/list-lancamentos.use-case';
import { MarcarComoPagoUseCase } from '../../application/use-cases/marcar-como-pago.use-case';
import { GerarCobrancasDoMesUseCase } from '../../application/use-cases/gerar-cobrancas-do-mes.use-case';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';

@Controller('financeiro')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class FinanceiroController {
  constructor(
    private readonly createLancamentoUseCase: CreateLancamentoUseCase,
    private readonly listLancamentosUseCase: ListLancamentosUseCase,
    private readonly marcarComoPagoUseCase: MarcarComoPagoUseCase,
    private readonly gerarCobrancasDoMesUseCase: GerarCobrancasDoMesUseCase,
  ) {}

  // POST /financeiro/lancamentos - cria um lancamento manual/avulso
  @Post('lancamentos')
  async create(@Body() dto: CreateLancamentoDto, @Req() req: Request) {
    return this.createLancamentoUseCase.execute({
      tenantId: req.user!.tenantId,
      contratoId: dto.contratoId,
      tipo: dto.tipo,
      categoria: dto.categoria,
      valor: dto.valor,
      vencimento: parseDateOnly(dto.vencimento),
      descricao: dto.descricao,
    });
  }

  // GET /financeiro/lancamentos - lista com filtros (tambem atualiza status
  // "atrasado" antes de retornar - ver ListLancamentosUseCase)
  @Get('lancamentos')
  async list(@Query() query: ListLancamentosQueryDto, @Req() req: Request) {
    return this.listLancamentosUseCase.execute({
      tenantId: req.user!.tenantId,
      tipo: query.tipo,
      status: query.status,
      contratoId: query.contratoId,
      vencimentoDe: query.vencimentoDe ? parseDateOnly(query.vencimentoDe) : undefined,
      vencimentoAte: query.vencimentoAte ? parseDateOnly(query.vencimentoAte) : undefined,
    });
  }

  // POST /financeiro/lancamentos/:id/marcar-pago
  @Post('lancamentos/:id/marcar-pago')
  @HttpCode(HttpStatus.OK)
  async marcarComoPago(@Param('id') id: string, @Req() req: Request) {
    return this.marcarComoPagoUseCase.execute({
      lancamentoId: id,
      tenantId: req.user!.tenantId,
    });
  }

  // POST /financeiro/gerar-cobrancas-mes - gera as cobrancas de aluguel do
  // mes para todos os contratos de locacao ativos (idempotente - seguro
  // clicar mais de uma vez, ver GerarCobrancasDoMesUseCase)
  @Post('gerar-cobrancas-mes')
  @HttpCode(HttpStatus.OK)
  async gerarCobrancasDoMes(@Req() req: Request) {
    return this.gerarCobrancasDoMesUseCase.execute({ tenantId: req.user!.tenantId });
  }
}
