// src/modules/gestao_imobiliaria/infra/http/inquilino-comprador.controller.ts
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
import { CreateInquilinoCompradorDto } from './dtos/create-inquilino-comprador.dto';
import { UpdateInquilinoCompradorDto } from './dtos/update-inquilino-comprador.dto';
import { UploadInquilinoDocumentoDto } from './dtos/upload-inquilino-documento.dto';
import { CreateInquilinoCompradorUseCase } from '../../application/use-cases/create-inquilino-comprador.use-case';
import { ListInquilinosCompradoresUseCase } from '../../application/use-cases/list-inquilinos-compradores.use-case';
import { UpdateInquilinoCompradorUseCase } from '../../application/use-cases/update-inquilino-comprador.use-case';
import { UploadInquilinoDocumentoUseCase } from '../../application/use-cases/upload-inquilino-documento.use-case';
import { ListInquilinoDocumentosUseCase } from '../../application/use-cases/list-inquilino-documentos.use-case';
import { DeleteInquilinoDocumentoUseCase } from '../../application/use-cases/delete-inquilino-documento.use-case';

@Controller('inquilinos-compradores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class InquilinoCompradorController {
  constructor(
    private readonly createInquilinoCompradorUseCase: CreateInquilinoCompradorUseCase,
    private readonly listInquilinosCompradoresUseCase: ListInquilinosCompradoresUseCase,
    private readonly updateInquilinoCompradorUseCase: UpdateInquilinoCompradorUseCase,
    private readonly uploadInquilinoDocumentoUseCase: UploadInquilinoDocumentoUseCase,
    private readonly listInquilinoDocumentosUseCase: ListInquilinoDocumentosUseCase,
    private readonly deleteInquilinoDocumentoUseCase: DeleteInquilinoDocumentoUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateInquilinoCompradorDto, @Req() req: Request) {
    return this.createInquilinoCompradorUseCase.execute({
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Get()
  async list(@Req() req: Request) {
    return this.listInquilinosCompradoresUseCase.execute(req.user!.tenantId);
  }

  // Analise de credito e documentos sao dados sensiveis - so Administrador
  // (mais estrito que DASHBOARD_ROLES usado em create/list acima).

  @Patch(':id')
  @Roles('Administrador')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInquilinoCompradorDto,
    @Req() req: Request,
  ) {
    return this.updateInquilinoCompradorUseCase.execute({
      inquilinoId: id,
      tenantId: req.user!.tenantId,
      ...dto,
    });
  }

  @Post(':id/documentos')
  @Roles('Administrador')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocumento(
    @Param('id') id: string,
    @Body() dto: UploadInquilinoDocumentoDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Req() req: Request,
  ) {
    return this.uploadInquilinoDocumentoUseCase.execute({
      inquilinoId: id,
      tenantId: req.user!.tenantId,
      tipo: dto.tipo,
      file,
    });
  }

  @Get(':id/documentos')
  @Roles('Administrador')
  async listDocumentos(@Param('id') id: string, @Req() req: Request) {
    return this.listInquilinoDocumentosUseCase.execute({
      inquilinoId: id,
      tenantId: req.user!.tenantId,
    });
  }

  @Delete(':id/documentos/:docId')
  @Roles('Administrador')
  @HttpCode(HttpStatus.OK)
  async deleteDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    await this.deleteInquilinoDocumentoUseCase.execute({
      documentoId: docId,
      tenantId: req.user!.tenantId,
    });
    return { message: 'Documento removido com sucesso.' };
  }
}
