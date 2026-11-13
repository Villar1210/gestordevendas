// src/modules/campanhas_sms/infra/http/campanha-sms.controller.ts
// Rotas da tela de campanhas. So Administrador (classe), reforcado nos use
// cases. tenantId/role/usuario/impersonadoPor sempre de req.user.
// Contrato: docs/campanhas/CONTRATO_CAMPANHA_SMS.md
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import {
  AtualizarCampanhaUseCase,
  CancelarCampanhaUseCase,
  CriarCampanhaUseCase,
  EnviarTesteUseCase,
  ExportarContatosUseCase,
  ImportarContatosUseCase,
  IniciarCampanhaUseCase,
  ListarCampanhasUseCase,
  ListarContatosUseCase,
  ListarOptoutsUseCase,
  ObterCampanhaUseCase,
  PausarCampanhaUseCase,
  RegistrarOptoutManualUseCase,
} from '../../application/use-cases/campanhas.use-cases';
import { LIMITES } from '../../domain/services/campanha-regras';
import {
  AtualizarCampanhaDto,
  CriarCampanhaDto,
  EnviarTesteDto,
  ExportarQueryDto,
  ImportarBodyDto,
  ListarContatosQueryDto,
  TelefoneDto,
} from './dtos/campanha.dto';
import { CampanhaEscritaThrottlerGuard, CampanhaTesteThrottlerGuard } from './campanha-sms-throttler.guard';

function requisitante(req: Request) {
  return {
    tenantId: req.user!.tenantId,
    requesterRole: req.user!.role,
    requesterUserId: req.user!.id,
    impersonadoPor: req.user!.impersonadoPor ?? null,
  };
}

const UUID = new ParseUUIDPipe();

@Controller('campanhas-sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class CampanhaSmsController {
  constructor(
    private readonly listar: ListarCampanhasUseCase,
    private readonly obter: ObterCampanhaUseCase,
    private readonly criar: CriarCampanhaUseCase,
    private readonly atualizar: AtualizarCampanhaUseCase,
    private readonly importar: ImportarContatosUseCase,
    private readonly listarContatos: ListarContatosUseCase,
    private readonly exportar: ExportarContatosUseCase,
    private readonly enviarTeste: EnviarTesteUseCase,
    private readonly iniciar: IniciarCampanhaUseCase,
    private readonly pausar: PausarCampanhaUseCase,
    private readonly cancelar: CancelarCampanhaUseCase,
    private readonly listarOptouts: ListarOptoutsUseCase,
    private readonly optoutManual: RegistrarOptoutManualUseCase,
  ) {}

  // Declaradas ANTES de ':id' para nao cairem no ParseUUIDPipe.
  @Get('optouts')
  async optouts(@Req() req: Request) {
    return this.listarOptouts.execute(requisitante(req));
  }

  @Post('optouts')
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async novoOptout(@Body() dto: TelefoneDto, @Req() req: Request) {
    return this.optoutManual.execute({ ...requisitante(req), telefone: dto.telefone });
  }

  @Get()
  async lista(@Req() req: Request) {
    return this.listar.execute(requisitante(req));
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async nova(@Body() dto: CriarCampanhaDto, @Req() req: Request) {
    return this.criar.execute({ ...requisitante(req), ...dto });
  }

  @Get(':id')
  async detalhe(@Param('id', UUID) id: string, @Req() req: Request) {
    return this.obter.execute({ ...requisitante(req), id });
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async editar(@Param('id', UUID) id: string, @Body() dto: AtualizarCampanhaDto, @Req() req: Request) {
    return this.atualizar.execute({ ...requisitante(req), id, ...dto });
  }

  @Post(':id/contatos/importar')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITES.arquivoBytes, files: 1, fields: 5 } }))
  async importarContatos(
    @Param('id', UUID) id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number } | undefined,
    @Body() body: ImportarBodyDto,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Envie a planilha no campo "file" (.xlsx ou .csv).');
    return this.importar.execute({
      ...requisitante(req),
      id,
      arquivo: file.buffer,
      nomeArquivo: String(file.originalname ?? '').slice(0, 200),
      substituir: body.substituir === true,
    });
  }

  @Get(':id/contatos')
  async contatos(@Param('id', UUID) id: string, @Query() q: ListarContatosQueryDto, @Req() req: Request) {
    return this.listarContatos.execute({ ...requisitante(req), id, status: q.status, busca: q.busca, pagina: q.pagina });
  }

  @Get(':id/contatos.csv')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async exportarCsv(@Param('id', UUID) id: string, @Query() q: ExportarQueryDto, @Req() req: Request, @Res() res: Response) {
    const { nomeArquivo, conteudo } = await this.exportar.execute({ ...requisitante(req), id, filtro: q.filtro ?? 'todos' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(conteudo);
  }

  @Post(':id/teste')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(CampanhaTesteThrottlerGuard)
  async teste(@Param('id', UUID) id: string, @Body() dto: EnviarTesteDto, @Req() req: Request) {
    return this.enviarTeste.execute({ ...requisitante(req), id, telefone: dto.telefone, primeiroNome: dto.primeiroNome });
  }

  @Post(':id/iniciar')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async comecar(@Param('id', UUID) id: string, @Req() req: Request) {
    return this.iniciar.execute({ ...requisitante(req), id });
  }

  @Post(':id/pausar')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async parar(@Param('id', UUID) id: string, @Req() req: Request) {
    return this.pausar.execute({ ...requisitante(req), id });
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(CampanhaEscritaThrottlerGuard)
  async encerrar(@Param('id', UUID) id: string, @Req() req: Request) {
    return this.cancelar.execute({ ...requisitante(req), id });
  }
}
