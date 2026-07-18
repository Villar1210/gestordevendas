// src/modules/vendas_kanban/infra/http/pipeline.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { BlockDeleteForCargoGuard } from '../../../../shared/infra/http/guards/block-delete-for-cargo.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreatePipelineDto } from './dtos/create-pipeline.dto';
import { CreateStageDto } from './dtos/create-stage.dto';
import { UpdateStageDto } from './dtos/update-stage.dto';
import { MoveStageDto } from './dtos/move-stage.dto';
import { CreatePipelineUseCase } from '../../application/use-cases/create-pipeline.use-case';
import { CreateDefaultPipelineUseCase } from '../../application/use-cases/create-default-pipeline.use-case';
import { ListPipelinesUseCase } from '../../application/use-cases/list-pipelines.use-case';
import { GetBoardUseCase } from '../../application/use-cases/get-board.use-case';
import { CreateStageUseCase } from '../../application/use-cases/create-stage.use-case';
import { MoveStageUseCase } from '../../application/use-cases/move-stage.use-case';
import { RenameStageUseCase } from '../../application/use-cases/rename-stage.use-case';
import { DeleteStageUseCase } from '../../application/use-cases/delete-stage.use-case';
import { GetInboxUseCase } from '../../application/use-cases/get-inbox.use-case';
import { GetMeuDashboardUseCase } from '../../application/use-cases/get-meu-dashboard.use-case';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class PipelineController {
  constructor(
    private readonly createPipelineUseCase: CreatePipelineUseCase,
    private readonly createDefaultPipelineUseCase: CreateDefaultPipelineUseCase,
    private readonly listPipelinesUseCase: ListPipelinesUseCase,
    private readonly getBoardUseCase: GetBoardUseCase,
    private readonly createStageUseCase: CreateStageUseCase,
    private readonly moveStageUseCase: MoveStageUseCase,
    private readonly renameStageUseCase: RenameStageUseCase,
    private readonly deleteStageUseCase: DeleteStageUseCase,
    private readonly getInboxUseCase: GetInboxUseCase,
    private readonly getMeuDashboardUseCase: GetMeuDashboardUseCase,
  ) {}

  // POST /pipelines - cria um pipeline vazio (sem stages)
  @Post('pipelines')
  async create(@Body() dto: CreatePipelineDto, @Req() req: Request) {
    return this.createPipelineUseCase.execute({ tenantId: req.user!.tenantId, name: dto.name });
  }

  // POST /pipelines/default - cria o pipeline padrao "Vendas Imoveis" com 5 stages
  @Post('pipelines/default')
  async createDefault(@Req() req: Request) {
    return this.createDefaultPipelineUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // GET /pipelines - lista os pipelines do tenant autenticado
  @Get('pipelines')
  async list(@Req() req: Request) {
    return this.listPipelinesUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // GET /pipelines/:id/board - retorna o pipeline com stages e cards ordenados
  @Get('pipelines/:id/board')
  async getBoard(@Param('id') id: string, @Req() req: Request) {
    return this.getBoardUseCase.execute({
      pipelineId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      requesterCargo: req.user!.cargo,
      requesterStandId: req.user!.standId,
    });
  }

  // POST /pipelines/:id/stages - cria uma nova coluna no final do pipeline
  @Post('pipelines/:id/stages')
  async createStage(
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
    @Req() req: Request,
  ) {
    return this.createStageUseCase.execute({
      tenantId: req.user!.tenantId,
      pipelineId: id,
      name: dto.name,
    });
  }

  // GET /pipelines/:id/inbox - cards do pipeline ainda sem stage (Caixa de Entrada)
  @Get('pipelines/:id/inbox')
  async getInbox(@Param('id') id: string, @Req() req: Request) {
    return this.getInboxUseCase.execute({
      pipelineId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
    });
  }

  // GET /pipelines/meu-dashboard - resumo dos proprios leads/atividades do
  // usuario logado (Dashboard do Corretor) - sempre escopado a ownerId=self,
  // independente de role/cargo.
  @Get('pipelines/meu-dashboard')
  async getMeuDashboard(@Req() req: Request) {
    return this.getMeuDashboardUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
    });
  }

  // PATCH /stages/:id/move - reordena colunas horizontalmente (posicao flutuante)
  @Patch('stages/:id/move')
  async moveStage(
    @Param('id') id: string,
    @Body() dto: MoveStageDto,
    @Req() req: Request,
  ) {
    return this.moveStageUseCase.execute({
      stageId: id,
      tenantId: req.user!.tenantId,
      targetIndex: dto.targetIndex,
    });
  }

  // PATCH /stages/:id - renomeia uma coluna
  @Patch('stages/:id')
  async renameStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @Req() req: Request,
  ) {
    return this.renameStageUseCase.execute({
      stageId: id,
      tenantId: req.user!.tenantId,
      name: dto.name,
    });
  }

  // DELETE /stages/:id - remove uma coluna vazia. Sistema de permissoes
  // por cargo (RBAC): Diretor/Gerente/Coordenador nao podem excluir
  // registros de negocio - ver BlockDeleteForCargoGuard.
  @Delete('stages/:id')
  @UseGuards(BlockDeleteForCargoGuard)
  async deleteStage(@Param('id') id: string, @Req() req: Request) {
    await this.deleteStageUseCase.execute({ stageId: id, tenantId: req.user!.tenantId });
    return { success: true };
  }
}
