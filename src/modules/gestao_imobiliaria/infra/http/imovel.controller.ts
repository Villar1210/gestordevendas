// src/modules/gestao_imobiliaria/infra/http/imovel.controller.ts
// Permissoes (16/10/2026): a CLASSE e so Administrador; cada rota liberada ao
// dashboard declara @Roles(...DASHBOARD_ROLES) explicito (rota nova esquecida
// nasce fechada - ver permissoes-imoveis-whatsapp.http.spec.ts, meta-teste).
// As regras finas (dono do cadastro, status por cargo) ficam nos use cases.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateImovelDto } from './dtos/create-imovel.dto';
import { UpdateImovelDto } from './dtos/update-imovel.dto';
import { ListImoveisQueryDto } from './dtos/list-imoveis-query.dto';
import { ReorderPhotosDto } from './dtos/reorder-photos.dto';
import { UpdateImovelStatusDto } from './dtos/update-imovel-status.dto';
import { atorDaRequisicao } from './ator-da-requisicao';
import { FOTO_MAX_BYTES } from '../../domain/services/foto-upload';
import { CreateImovelUseCase } from '../../application/use-cases/create-imovel.use-case';
import { UpdateImovelUseCase } from '../../application/use-cases/update-imovel.use-case';
import { ListImoveisUseCase } from '../../application/use-cases/list-imoveis.use-case';
import { GetImovelUseCase } from '../../application/use-cases/get-imovel.use-case';
import { UploadImovelPhotoUseCase } from '../../application/use-cases/upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from '../../application/use-cases/delete-imovel-photo.use-case';
import { ReorderImovelPhotosUseCase } from '../../application/use-cases/reorder-imovel-photos.use-case';
import { AlterarStatusImovelUseCase } from '../../application/use-cases/alterar-status-imovel.use-case';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';

@Controller('imoveis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class ImovelController {
  constructor(
    private readonly createImovelUseCase: CreateImovelUseCase,
    private readonly updateImovelUseCase: UpdateImovelUseCase,
    private readonly listImoveisUseCase: ListImoveisUseCase,
    private readonly getImovelUseCase: GetImovelUseCase,
    private readonly uploadImovelPhotoUseCase: UploadImovelPhotoUseCase,
    private readonly deleteImovelPhotoUseCase: DeleteImovelPhotoUseCase,
    private readonly reorderImovelPhotosUseCase: ReorderImovelPhotosUseCase,
    private readonly alterarStatusImovelUseCase: AlterarStatusImovelUseCase,
  ) {}

  // Corretor tambem cadastra (R2): o use case forca status/publicado.
  @Post()
  @Roles(...DASHBOARD_ROLES)
  async create(@Body() dto: CreateImovelDto, @Req() req: Request) {
    return this.createImovelUseCase.execute({
      tenantId: req.user!.tenantId,
      ...dto,
      ator: atorDaRequisicao(req),
      disponivelApartirDe: dto.disponivelApartirDe
        ? parseDateOnly(dto.disponivelApartirDe)
        : undefined,
    });
  }

  @Get()
  @Roles(...DASHBOARD_ROLES)
  async list(@Query() query: ListImoveisQueryDto, @Req() req: Request) {
    return this.listImoveisUseCase.execute({
      tenantId: req.user!.tenantId,
      finalidade: query.finalidade,
      status: query.status,
      empreendimentoId: query.empreendimentoId,
      busca: query.busca,
    });
  }

  @Get(':id')
  @Roles(...DASHBOARD_ROLES)
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.getImovelUseCase.execute({ imovelId: id, tenantId: req.user!.tenantId });
  }

  // R2 no use case: nao-admin so edita o que criou, antes de publicar, e
  // sem mudar status/publicado.
  @Patch(':id')
  @Roles(...DASHBOARD_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateImovelDto, @Req() req: Request) {
    return this.updateImovelUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      ...dto,
      ator: atorDaRequisicao(req),
      disponivelApartirDe:
        dto.disponivelApartirDe === undefined
          ? undefined
          : dto.disponivelApartirDe === null
            ? null
            : parseDateOnly(dto.disponivelApartirDe),
    });
  }

  // PATCH /imoveis/:id/status - so o status (Espelho de Vendas). Liberada
  // ao dashboard no guard; R1 (gerencia ou admin) no use case.
  @Patch(':id/status')
  @Roles(...DASHBOARD_ROLES)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateImovelStatusDto,
    @Req() req: Request,
  ) {
    return this.alterarStatusImovelUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      status: dto.status,
      ator: atorDaRequisicao(req),
    });
  }

  // Fotos (R2 no use case): mesma regra de dono do PATCH /imoveis/:id.
  @Post(':id/photos')
  @Roles(...DASHBOARD_ROLES)
  // 1 foto de ate 10 MB (acima: 413 do multer). Tipo real validado no use case.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FOTO_MAX_BYTES, files: 1 } }))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.uploadImovelPhotoUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      file,
      ator: atorDaRequisicao(req),
    });
  }

  @Delete(':id/photos/:photoId')
  @Roles(...DASHBOARD_ROLES)
  @HttpCode(HttpStatus.OK)
  async deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    await this.deleteImovelPhotoUseCase.execute({
      imovelId: id,
      photoId,
      tenantId: req.user!.tenantId,
      ator: atorDaRequisicao(req),
    });
    return { message: 'Foto removida com sucesso.' };
  }

  // PATCH /imoveis/:id/photos/reorder - Fatia 5: photoIds na ordem final
  // desejada (precisa corresponder exatamente as fotos ja existentes, ver
  // ReorderImovelPhotosUseCase).
  @Patch(':id/photos/reorder')
  @Roles(...DASHBOARD_ROLES)
  async reorderPhotos(
    @Param('id') id: string,
    @Body() dto: ReorderPhotosDto,
    @Req() req: Request,
  ) {
    return this.reorderImovelPhotosUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      photoIds: dto.photoIds,
      ator: atorDaRequisicao(req),
    });
  }
}
