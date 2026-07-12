// src/modules/edoc/infra/http/envelope.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateEnvelopeDto } from './dtos/create-envelope.dto';
import { UpdateEnvelopeDraftDto } from './dtos/update-envelope-draft.dto';
import { CreateEnvelopeUseCase } from '../../application/use-cases/create-envelope.use-case';
import { SendEnvelopeUseCase } from '../../application/use-cases/send-envelope.use-case';
import { ListEnvelopesUseCase } from '../../application/use-cases/list-envelopes.use-case';
import { GetEnvelopeDetailUseCase } from '../../application/use-cases/get-envelope-detail.use-case';
import { GetEnvelopeForEditUseCase } from '../../application/use-cases/get-envelope-for-edit.use-case';
import { UpdateEnvelopeDraftUseCase } from '../../application/use-cases/update-envelope-draft.use-case';
import { CancelEnvelopeUseCase } from '../../application/use-cases/cancel-envelope.use-case';
import { GetSignedPdfUseCase } from '../../application/use-cases/get-signed-pdf.use-case';

const VALID_ROLES = ['destinatario', 'remetente', 'testemunha'];
const VALID_FIELD_TIPOS = ['assinatura', 'rubrica'];
// Multer so limita tamanho aqui - a validacao de extensao/mimetype (PDF ou
// Word/Excel convertivel) acontece dentro de PrepareEnvelopeDocumentService,
// que da uma mensagem de erro melhor do que um fileFilter generico.
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

interface RecipientInput {
  name: string;
  email: string;
  role?: string;
}

interface FieldInput {
  recipientIndex: number;
  tipo?: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  heightPercent?: number;
}

@Controller('edoc/envelopes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class EnvelopeController {
  constructor(
    private readonly createEnvelopeUseCase: CreateEnvelopeUseCase,
    private readonly sendEnvelopeUseCase: SendEnvelopeUseCase,
    private readonly listEnvelopesUseCase: ListEnvelopesUseCase,
    private readonly getEnvelopeDetailUseCase: GetEnvelopeDetailUseCase,
    private readonly getEnvelopeForEditUseCase: GetEnvelopeForEditUseCase,
    private readonly updateEnvelopeDraftUseCase: UpdateEnvelopeDraftUseCase,
    private readonly cancelEnvelopeUseCase: CancelEnvelopeUseCase,
    private readonly getSignedPdfUseCase: GetSignedPdfUseCase,
  ) {}

  // POST /edoc/envelopes - cria o envelope em rascunho (multipart: file + title + recipients)
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async create(
    @Body() dto: CreateEnvelopeDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Envie o arquivo do documento (PDF, Word ou Excel).');
    }
    const { recipients, fields } = this.parseRecipientsAndFields(dto.recipients, dto.fields);

    return this.createEnvelopeUseCase.execute({
      tenantId: req.user!.tenantId,
      createdByUserId: req.user!.id,
      title: dto.title,
      file,
      recipients,
      fields,
      emailSubject: dto.emailSubject,
      emailMessage: dto.emailMessage,
    });
  }

  // GET /edoc/envelopes/:id/edit - dados completos para reabrir um rascunho
  // no wizard (Fatia 4 - corrige o "bug do rascunho": antes disso, um
  // envelope que ficasse em rascunho nao tinha como ser retomado).
  @Get(':id/edit')
  async getForEdit(@Param('id') id: string, @Req() req: Request) {
    return this.getEnvelopeForEditUseCase.execute({ envelopeId: id, tenantId: req.user!.tenantId });
  }

  // PATCH /edoc/envelopes/:id - atualiza um rascunho existente (Fatia 4).
  // Arquivo e opcional - so enviado quando o usuario troca o documento.
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEnvelopeDraftDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    @Req() req: Request,
  ) {
    const { recipients, fields } = this.parseRecipientsAndFields(dto.recipients, dto.fields);

    return this.updateEnvelopeDraftUseCase.execute({
      envelopeId: id,
      tenantId: req.user!.tenantId,
      title: dto.title,
      file,
      recipients,
      fields,
      emailSubject: dto.emailSubject,
      emailMessage: dto.emailMessage,
    });
  }

  // POST /edoc/envelopes/:id/send - envia para o primeiro destinatario da ordem
  @Post(':id/send')
  async send(@Param('id') id: string, @Req() req: Request) {
    return this.sendEnvelopeUseCase.execute({ envelopeId: id, tenantId: req.user!.tenantId });
  }

  // GET /edoc/envelopes - lista os envelopes do tenant autenticado, com
  // filtro opcional por status e busca por titulo (Fatia 4).
  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.listEnvelopesUseCase.execute({ tenantId: req.user!.tenantId, status, search });
  }

  // GET /edoc/envelopes/:id - detalhe + destinatarios
  @Get(':id')
  async getDetail(@Param('id') id: string, @Req() req: Request) {
    return this.getEnvelopeDetailUseCase.execute({ envelopeId: id, tenantId: req.user!.tenantId });
  }

  // GET /edoc/envelopes/:id/signed-pdf - url do PDF final (so quando concluido)
  @Get(':id/signed-pdf')
  async getSignedPdf(@Param('id') id: string, @Req() req: Request) {
    return this.getSignedPdfUseCase.execute({ envelopeId: id, tenantId: req.user!.tenantId });
  }

  // POST /edoc/envelopes/:id/cancel - Administrador ou quem criou o envelope
  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: Request) {
    return this.cancelEnvelopeUseCase.execute({
      envelopeId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
    });
  }

  // Compartilhado por create() e update() - o payload de destinatarios/
  // campos chega identico nas duas rotas (JSON stringificado, ver DTOs).
  private parseRecipientsAndFields(
    recipientsRaw: string,
    fieldsRaw: string,
  ): { recipients: RecipientInput[]; fields: FieldInput[] } {
    let recipients: RecipientInput[];
    try {
      recipients = JSON.parse(recipientsRaw);
    } catch {
      throw new BadRequestException('Lista de destinatarios invalida.');
    }
    if (
      !Array.isArray(recipients) ||
      recipients.some(
        (r) =>
          typeof r?.name !== 'string' ||
          typeof r?.email !== 'string' ||
          (r.role !== undefined && !VALID_ROLES.includes(r.role)),
      )
    ) {
      throw new BadRequestException('Lista de destinatarios invalida.');
    }

    let fields: FieldInput[];
    try {
      fields = JSON.parse(fieldsRaw);
    } catch {
      throw new BadRequestException('Lista de campos de assinatura invalida.');
    }
    if (
      !Array.isArray(fields) ||
      fields.some(
        (f) =>
          typeof f?.recipientIndex !== 'number' ||
          typeof f?.pageNumber !== 'number' ||
          typeof f?.xPercent !== 'number' ||
          typeof f?.yPercent !== 'number' ||
          (f.tipo !== undefined && !VALID_FIELD_TIPOS.includes(f.tipo)),
      )
    ) {
      throw new BadRequestException('Lista de campos de assinatura invalida.');
    }

    return { recipients, fields };
  }
}
