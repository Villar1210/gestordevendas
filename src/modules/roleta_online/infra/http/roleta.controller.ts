// src/modules/roleta_online/infra/http/roleta.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { UpdateRoletaConfigDto } from './dtos/update-roleta-config.dto';
import { GetRoletaConfigUseCase } from '../../application/use-cases/get-roleta-config.use-case';
import { UpdateRoletaConfigUseCase } from '../../application/use-cases/update-roleta-config.use-case';
import { ConfirmSuggestedOwnerUseCase } from '../../application/use-cases/confirm-suggested-owner.use-case';
import { AceitarLeadUseCase } from '../../application/use-cases/aceitar-lead.use-case';
import { SalvarRoletaDto } from './dtos/salvar-roleta.dto';
import { ListRoletasUseCase } from '../../application/use-cases/list-roletas.use-case';
import { SalvarRoletaUseCase } from '../../application/use-cases/salvar-roleta.use-case';
import { ExcluirRoletaUseCase } from '../../application/use-cases/excluir-roleta.use-case';
import { SortearRoletaUseCase } from '../../application/use-cases/sortear-roleta.use-case';
import { ListSorteiosUseCase } from '../../application/use-cases/list-sorteios.use-case';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class RoletaController {
  constructor(
    private readonly getRoletaConfigUseCase: GetRoletaConfigUseCase,
    private readonly updateRoletaConfigUseCase: UpdateRoletaConfigUseCase,
    private readonly confirmSuggestedOwnerUseCase: ConfirmSuggestedOwnerUseCase,
    private readonly aceitarLeadUseCase: AceitarLeadUseCase,
    private readonly listRoletasUseCase: ListRoletasUseCase,
    private readonly salvarRoletaUseCase: SalvarRoletaUseCase,
    private readonly excluirRoletaUseCase: ExcluirRoletaUseCase,
    private readonly sortearRoletaUseCase: SortearRoletaUseCase,
    private readonly listSorteiosUseCase: ListSorteiosUseCase,
  ) {}

  // ===== Fatia 2 (Sorteio da vez) =====

  // GET /roletas - roletas com a fila atual (todos do dashboard veem a ordem)
  @Get('roletas')
  async listRoletas(@Req() req: Request) {
    return this.listRoletasUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo ?? null,
    });
  }

  // POST /roletas - cria (so Administrador)
  @Post('roletas')
  async criarRoleta(@Body() dto: SalvarRoletaDto, @Req() req: Request) {
    return this.salvarRoletaUseCase.execute({ ...dto, tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  // PATCH /roletas/:id - altera (so Administrador)
  @Patch('roletas/:id')
  async alterarRoleta(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SalvarRoletaDto, @Req() req: Request) {
    return this.salvarRoletaUseCase.execute({ ...dto, id, tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  // DELETE /roletas/:id (so Administrador)
  @Delete('roletas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluirRoleta(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.excluirRoletaUseCase.execute({ id, tenantId: req.user!.tenantId, requesterRole: req.user!.role });
  }

  // POST /roletas/:id/sortear - botao "Sortear agora" (Administrador,
  // gerentes, diretores e coordenadores)
  @Post('roletas/:id/sortear')
  async sortearRoleta(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sortearRoletaUseCase.execute({
      tenantId: req.user!.tenantId,
      roletaId: id,
      userId: req.user!.id,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo ?? null,
    });
  }

  // GET /roletas/:id/sorteios - historico (ultimos 30)
  @Get('roletas/:id/sorteios')
  async listSorteios(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.listSorteiosUseCase.execute({ tenantId: req.user!.tenantId, roletaId: id });
  }

  // GET /roleta/config - configuracao atual da Roleta Online do tenant
  @Get('roleta/config')
  async getConfig(@Req() req: Request) {
    return this.getRoletaConfigUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /roleta/config - atualiza a configuracao (so Administrador)
  @Patch('roleta/config')
  async updateConfig(@Body() dto: UpdateRoletaConfigDto, @Req() req: Request) {
    return this.updateRoletaConfigUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      algoritmo: dto.algoritmo,
      modo: dto.modo,
      ativa: dto.ativa,
      timeoutAceiteMinutos: dto.timeoutAceiteMinutos,
      minutosInatividadeOffline: dto.minutosInatividadeOffline,
    });
  }

  // POST /cards/:id/confirmar-sugestao - confirma a sugestao da Roleta
  // (modo semi_automatico); so o proprio corretor sugerido ou um Administrador.
  @Post('cards/:id/confirmar-sugestao')
  async confirmSuggestion(@Param('id') id: string, @Req() req: Request) {
    return this.confirmSuggestedOwnerUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo,
    });
  }

  // POST /cards/:id/aceitar-lead - corretor confirma que vai atender uma
  // atribuicao automatica da Roleta antes do timeout reatribuir o card.
  @Post('cards/:id/aceitar-lead')
  async aceitarLead(@Param('id') id: string, @Req() req: Request) {
    return this.aceitarLeadUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
      requesterRole: req.user!.role,
    });
  }
}
