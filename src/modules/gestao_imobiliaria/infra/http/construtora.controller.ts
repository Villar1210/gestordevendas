// src/modules/gestao_imobiliaria/infra/http/construtora.controller.ts
// Cadastro de Construtoras (Fatia A - docs/construtoras/CONTRATO_CONSTRUTORAS.md).
// Mesmo padrao de permissoes da area Imoveis: a CLASSE e so Administrador
// (criar/editar/excluir/logo); so as LEITURAS declaram DASHBOARD_ROLES
// (Corretor le). Rota nova esquecida nasce fechada - ver o meta-teste em
// permissoes-imoveis.http.spec.ts.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AtualizarConstrutoraDto, CriarConstrutoraDto } from './dtos/construtora.dto';
import {
  AtualizarConstrutoraUseCase,
  BuscarConstrutoraUseCase,
  CriarConstrutoraUseCase,
  EnviarLogoConstrutoraUseCase,
  ExcluirConstrutoraUseCase,
  ListarConstrutorasUseCase,
  RemoverLogoConstrutoraUseCase,
} from '../../application/use-cases/construtoras.use-cases';
import { CONSTRUTORA_LOGO_MAX_BYTES } from '../../domain/services/construtora';

@Controller('construtoras')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class ConstrutoraController {
  constructor(
    private readonly listarUseCase: ListarConstrutorasUseCase,
    private readonly buscarUseCase: BuscarConstrutoraUseCase,
    private readonly criarUseCase: CriarConstrutoraUseCase,
    private readonly atualizarUseCase: AtualizarConstrutoraUseCase,
    private readonly excluirUseCase: ExcluirConstrutoraUseCase,
    private readonly enviarLogoUseCase: EnviarLogoConstrutoraUseCase,
    private readonly removerLogoUseCase: RemoverLogoConstrutoraUseCase,
  ) {}

  @Get()
  @Roles(...DASHBOARD_ROLES)
  async list(@Req() req: Request) {
    return this.listarUseCase.execute({ tenantId: req.user!.tenantId });
  }

  @Get(':id')
  @Roles(...DASHBOARD_ROLES)
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.buscarUseCase.execute({ tenantId: req.user!.tenantId, id });
  }

  @Post()
  async create(@Body() dto: CriarConstrutoraDto, @Req() req: Request) {
    return this.criarUseCase.execute({
      tenantId: req.user!.tenantId,
      nome: dto.nome,
      site: dto.site,
      sobre: dto.sobre,
      diferenciais: dto.diferenciais,
    });
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarConstrutoraDto, @Req() req: Request) {
    return this.atualizarUseCase.execute({
      tenantId: req.user!.tenantId,
      id,
      nome: dto.nome,
      site: dto.site,
      sobre: dto.sobre,
      diferenciais: dto.diferenciais,
    });
  }

  // 409 com a quantidade quando ha empreendimentos vinculados (decisao do
  // Villar: bloquear, nunca desvincular sozinho).
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.excluirUseCase.execute({ tenantId: req.user!.tenantId, id });
  }

  // 1 imagem de ate 2 MB (acima: 413 do multer); tipo real no use case.
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CONSTRUTORA_LOGO_MAX_BYTES, files: 1 } }))
  async uploadLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Req() req: Request,
  ) {
    return this.enviarLogoUseCase.execute({ tenantId: req.user!.tenantId, id, file });
  }

  @Delete(':id/logo')
  @HttpCode(HttpStatus.OK)
  async deleteLogo(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.removerLogoUseCase.execute({ tenantId: req.user!.tenantId, id });
  }
}
