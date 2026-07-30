// src/modules/vendas_kanban/infra/http/card.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { BlockDeleteForCargoGuard } from '../../../../shared/infra/http/guards/block-delete-for-cargo.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateCardDto } from './dtos/create-card.dto';
import { UpdateCardDto } from './dtos/update-card.dto';
import { MoveCardDto } from './dtos/move-card.dto';
import { CreateActivityDto } from './dtos/create-activity.dto';
import { CreateNoteDto } from './dtos/create-note.dto';
import { CreateQuickCardDto } from './dtos/create-quick-card.dto';
import { CreateCardUseCase } from '../../application/use-cases/create-card.use-case';
import { UpdateCardUseCase } from '../../application/use-cases/update-card.use-case';
import { MoveCardUseCase } from '../../application/use-cases/move-card.use-case';
import { DeleteCardUseCase } from '../../application/use-cases/delete-card.use-case';
import { CreateActivityUseCase } from '../../application/use-cases/create-activity.use-case';
import { ListActivitiesByCardUseCase } from '../../application/use-cases/list-activities-by-card.use-case';
import { ToggleActivityDoneUseCase } from '../../application/use-cases/toggle-activity-done.use-case';
import { CreateNoteUseCase } from '../../application/use-cases/create-note.use-case';
import { ListNotesByCardUseCase } from '../../application/use-cases/list-notes-by-card.use-case';
import { CreateQuickCardUseCase } from '../../application/use-cases/create-quick-card.use-case';
import { ClaimCardUseCase } from '../../application/use-cases/claim-card.use-case';
import { DispararRepiqueManualUseCase } from '../../application/use-cases/disparar-repique-manual.use-case';
import { ListMinhaCarteiraRepiqueUseCase } from '../../application/use-cases/list-minha-carteira-repique.use-case';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class CardController {
  constructor(
    private readonly createCardUseCase: CreateCardUseCase,
    private readonly updateCardUseCase: UpdateCardUseCase,
    private readonly moveCardUseCase: MoveCardUseCase,
    private readonly deleteCardUseCase: DeleteCardUseCase,
    private readonly createActivityUseCase: CreateActivityUseCase,
    private readonly listActivitiesByCardUseCase: ListActivitiesByCardUseCase,
    private readonly toggleActivityDoneUseCase: ToggleActivityDoneUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly listNotesByCardUseCase: ListNotesByCardUseCase,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly claimCardUseCase: ClaimCardUseCase,
    private readonly dispararRepiqueManualUseCase: DispararRepiqueManualUseCase,
    private readonly listMinhaCarteiraRepiqueUseCase: ListMinhaCarteiraRepiqueUseCase,
  ) {}

  // GET /cards/repique/minha-carteira - cards na stage Repique visiveis
  // para o requisitante (escopo RBAC por cargo), com motivo/data de
  // entrada/ultimo envio - para decidir onde disparar manualmente.
  @Get('cards/repique/minha-carteira')
  async minhaCarteiraRepique(@Req() req: Request) {
    return this.listMinhaCarteiraRepiqueUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo,
      requesterStandId: req.user!.standId,
    });
  }

  // POST /cards/:id/repique/disparar-agora - dispara manualmente o proximo
  // envio de campanha do Repique para este card, sem esperar o job
  // automatico de 2 em 2 dias.
  @Post('cards/:id/repique/disparar-agora')
  async dispararRepique(@Param('id') id: string, @Req() req: Request) {
    return this.dispararRepiqueManualUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      requesterUserId: req.user!.id,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo,
    });
  }

  // POST /cards - cria um card (no final da stage informada, ou na
  // primeira stage do pipeline informado). O usuario logado sempre vira o dono.
  @Post('cards')
  async create(@Body() dto: CreateCardDto, @Req() req: Request) {
    return this.createCardUseCase.execute({
      tenantId: req.user!.tenantId,
      ownerId: req.user!.id,
      stageId: dto.stageId,
      pipelineId: dto.pipelineId,
      title: dto.title,
      value: dto.value,
      origem: dto.origem,
      phone: dto.phone,
      temperatura: dto.temperatura,
      imovelId: dto.imovelId,
      customFields: dto.customFields,
    });
  }

  // PATCH /cards/:id - edita title/value/phone/temperatura/email/endereco/.../customFields
  @Patch('cards/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateCardDto, @Req() req: Request) {
    return this.updateCardUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      title: dto.title,
      value: dto.value,
      phone: dto.phone,
      temperatura: dto.temperatura,
      email: dto.email,
      endereco: dto.endereco,
      numero: dto.numero,
      complemento: dto.complemento,
      bairro: dto.bairro,
      cep: dto.cep,
      imovelId: dto.imovelId,
      customFields: dto.customFields,
    });
  }

  // POST /cards/quick - cria um card cru na Caixa de Entrada (sem stage, sem dono)
  @Post('cards/quick')
  async createQuick(@Body() dto: CreateQuickCardDto, @Req() req: Request) {
    return this.createQuickCardUseCase.execute({
      tenantId: req.user!.tenantId,
      pipelineId: dto.pipelineId,
      title: dto.title,
      value: dto.value,
      origem: dto.origem,
      phone: dto.phone,
      temperatura: dto.temperatura,
      imovelId: dto.imovelId,
      customFields: dto.customFields,
    });
  }

  // POST /cards/:id/claim - o usuario logado assume o lead (dono + primeira stage)
  @Post('cards/:id/claim')
  async claim(@Param('id') id: string, @Req() req: Request) {
    return this.claimCardUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      requesterRole: req.user!.role,
      requesterCargo: req.user!.cargo,
    });
  }

  // PATCH /cards/:id/move - move o card para outra posicao/coluna (posicao flutuante)
  @Patch('cards/:id/move')
  async move(@Param('id') id: string, @Body() dto: MoveCardDto, @Req() req: Request) {
    return this.moveCardUseCase.execute({
      cardId: id,
      tenantId: req.user!.tenantId,
      targetStageId: dto.targetStageId,
      targetIndex: dto.targetIndex,
      motivoRepique: dto.motivoRepique,
    });
  }

  // DELETE /cards/:id - remove o card definitivamente. Sistema de
  // permissoes por cargo (RBAC): Diretor/Gerente/Coordenador nao podem
  // excluir registros de negocio - ver BlockDeleteForCargoGuard.
  @Delete('cards/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BlockDeleteForCargoGuard)
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.deleteCardUseCase.execute({ cardId: id, tenantId: req.user!.tenantId });
    return { message: 'Card removido com sucesso.' };
  }

  // POST /cards/:cardId/activities - agenda/registra uma atividade no card
  @Post('cards/:cardId/activities')
  async createActivity(
    @Param('cardId') cardId: string,
    @Body() dto: CreateActivityDto,
    @Req() req: Request,
  ) {
    return this.createActivityUseCase.execute({
      tenantId: req.user!.tenantId,
      cardId,
      type: dto.type,
      subject: dto.subject,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });
  }

  // GET /cards/:cardId/activities - lista atividades do card
  @Get('cards/:cardId/activities')
  async listActivities(@Param('cardId') cardId: string, @Req() req: Request) {
    return this.listActivitiesByCardUseCase.execute({ tenantId: req.user!.tenantId, cardId });
  }

  // PATCH /activities/:id/toggle-done - alterna concluida/pendente
  @Patch('activities/:id/toggle-done')
  async toggleActivityDone(@Param('id') id: string, @Req() req: Request) {
    return this.toggleActivityDoneUseCase.execute({
      activityId: id,
      tenantId: req.user!.tenantId,
    });
  }

  // POST /cards/:cardId/notes - adiciona uma anotacao ao card
  @Post('cards/:cardId/notes')
  async createNote(
    @Param('cardId') cardId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ) {
    return this.createNoteUseCase.execute({
      tenantId: req.user!.tenantId,
      cardId,
      body: dto.body,
    });
  }

  // GET /cards/:cardId/notes - lista anotacoes do card (mais recente primeiro)
  @Get('cards/:cardId/notes')
  async listNotes(@Param('cardId') cardId: string, @Req() req: Request) {
    return this.listNotesByCardUseCase.execute({ tenantId: req.user!.tenantId, cardId });
  }
}
