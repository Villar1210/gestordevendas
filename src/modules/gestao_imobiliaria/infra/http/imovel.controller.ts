// src/modules/gestao_imobiliaria/infra/http/imovel.controller.ts
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
import { CreateImovelDto } from './dtos/create-imovel.dto';
import { UpdateImovelDto } from './dtos/update-imovel.dto';
import { ListImoveisQueryDto } from './dtos/list-imoveis-query.dto';
import { CreateImovelUseCase } from '../../application/use-cases/create-imovel.use-case';
import { UpdateImovelUseCase } from '../../application/use-cases/update-imovel.use-case';
import { ListImoveisUseCase } from '../../application/use-cases/list-imoveis.use-case';
import { GetImovelUseCase } from '../../application/use-cases/get-imovel.use-case';
import { UploadImovelPhotoUseCase } from '../../application/use-cases/upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from '../../application/use-cases/delete-imovel-photo.use-case';

@Controller('imoveis')
@UseGuards(JwtAuthGuard)
export class ImovelController {
  constructor(
    private readonly createImovelUseCase: CreateImovelUseCase,
    private readonly updateImovelUseCase: UpdateImovelUseCase,
    private readonly listImoveisUseCase: ListImoveisUseCase,
    private readonly getImovelUseCase: GetImovelUseCase,
    private readonly uploadImovelPhotoUseCase: UploadImovelPhotoUseCase,
    private readonly deleteImovelPhotoUseCase: DeleteImovelPhotoUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateImovelDto, @Req() req: Request) {
    return this.createImovelUseCase.execute({
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Get()
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
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.getImovelUseCase.execute({ imovelId: id, tenantId: req.user!.tenantId });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateImovelDto, @Req() req: Request) {
    return this.updateImovelUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.uploadImovelPhotoUseCase.execute({
      imovelId: id,
      tenantId: req.user!.tenantId,
      file,
    });
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.OK)
  async deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    await this.deleteImovelPhotoUseCase.execute({ photoId, tenantId: req.user!.tenantId });
    return { message: 'Foto removida com sucesso.' };
  }
}
