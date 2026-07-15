// src/modules/atendimento/infra/http/atendimento.controller.ts
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { TransferAtendimentoDto } from './dtos/transfer-atendimento.dto';
import { CloseAtendimentoDto } from './dtos/close-atendimento.dto';
import { AddNotaAtendimentoDto } from './dtos/add-nota-atendimento.dto';
import { EnviarMensagemAtendimentoDto } from './dtos/enviar-mensagem-atendimento.dto';
import { ListAtendimentosUseCase } from '../../application/use-cases/list-atendimentos.use-case';
import { GetAtendimentoDetailUseCase } from '../../application/use-cases/get-atendimento-detail.use-case';
import { AssignAtendimentoUseCase } from '../../application/use-cases/assign-atendimento.use-case';
import { TransferAtendimentoUseCase } from '../../application/use-cases/transfer-atendimento.use-case';
import { RequeueAtendimentoUseCase } from '../../application/use-cases/requeue-atendimento.use-case';
import { CloseAtendimentoUseCase } from '../../application/use-cases/close-atendimento.use-case';
import { AddNotaAtendimentoUseCase } from '../../application/use-cases/add-nota-atendimento.use-case';
import { EnviarMensagemAtendimentoUseCase } from '../../application/use-cases/enviar-mensagem-atendimento.use-case';

@Controller('atendimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class AtendimentoController {
  constructor(
    private readonly listAtendimentosUseCase: ListAtendimentosUseCase,
    private readonly getAtendimentoDetailUseCase: GetAtendimentoDetailUseCase,
    private readonly assignAtendimentoUseCase: AssignAtendimentoUseCase,
    private readonly transferAtendimentoUseCase: TransferAtendimentoUseCase,
    private readonly requeueAtendimentoUseCase: RequeueAtendimentoUseCase,
    private readonly closeAtendimentoUseCase: CloseAtendimentoUseCase,
    private readonly addNotaAtendimentoUseCase: AddNotaAtendimentoUseCase,
    private readonly enviarMensagemAtendimentoUseCase: EnviarMensagemAtendimentoUseCase,
  ) {}

  // GET /atendimentos?filaId=&status=&ownerId= - Administrador ve tudo,
  // Corretor/Agente ve so o que pertence as proprias filas + o que ja assumiu.
  @Get()
  async list(
    @Req() req: Request,
    @Query('filaId') filaId?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.listAtendimentosUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      requesterCargo: req.user!.cargo,
      filaId,
      status,
      ownerId,
    });
  }

  // GET /atendimentos/:id - detalhe + eventos + mensagens
  @Get(':id')
  async getDetail(@Param('id') id: string, @Req() req: Request) {
    return this.getAtendimentoDetailUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      requesterCargo: req.user!.cargo,
    });
  }

  // POST /atendimentos/:id/assign - agente assume o atendimento
  @Post(':id/assign')
  async assign(@Param('id') id: string, @Req() req: Request) {
    return this.assignAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
    });
  }

  // POST /atendimentos/:id/transfer - muda fila e/ou agente responsavel
  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferAtendimentoDto,
    @Req() req: Request,
  ) {
    return this.transferAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      requesterId: req.user!.id,
      requesterRole: req.user!.role,
      novoFilaId: dto.filaId,
      novoOwnerId: dto.ownerId,
    });
  }

  // POST /atendimentos/:id/requeue - devolve para a fila sem dono
  @Post(':id/requeue')
  async requeue(@Param('id') id: string, @Req() req: Request) {
    return this.requeueAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      requesterId: req.user!.id,
      requesterRole: req.user!.role,
    });
  }

  // POST /atendimentos/:id/close - encerra com motivo opcional
  @Post(':id/close')
  async close(@Param('id') id: string, @Body() dto: CloseAtendimentoDto, @Req() req: Request) {
    return this.closeAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      requesterId: req.user!.id,
      requesterRole: req.user!.role,
      motivo: dto.motivo,
    });
  }

  // POST /atendimentos/:id/nota - registra uma nota interna
  @Post(':id/nota')
  async addNota(@Param('id') id: string, @Body() dto: AddNotaAtendimentoDto, @Req() req: Request) {
    return this.addNotaAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      userId: req.user!.id,
      texto: dto.texto,
    });
  }

  // POST /atendimentos/:id/enviar-mensagem - responde o contato via WhatsApp
  @Post(':id/enviar-mensagem')
  async enviarMensagem(
    @Param('id') id: string,
    @Body() dto: EnviarMensagemAtendimentoDto,
    @Req() req: Request,
  ) {
    await this.enviarMensagemAtendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      atendimentoId: id,
      body: dto.body,
    });
    return { ok: true };
  }
}
