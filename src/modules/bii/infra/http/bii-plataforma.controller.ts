// src/modules/bii/infra/http/bii-plataforma.controller.ts
// Dados PUBLICOS do BII (ITBI global) - so Super Usuario (classe), reforcado
// nos use cases. Nenhuma rota de tenant escreve nessas tabelas.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';
import {
  GetGeocodificacaoItbiUseCase,
  ImportarItbiUseCase,
  IniciarGeocodificacaoItbiUseCase,
  ListImportacoesItbiUseCase,
} from '../../application/use-cases/itbi-plataforma.use-cases';
import { GeocodificarItbiDto } from './dtos/analisar-endereco.dto';
import { ArquivoItbiUpload, BiiItbiImportarLimiteGuard, ItbiUploadTamanhoGuard, opcoesMulterItbi } from './itbi-upload';

@Controller('bii-plataforma')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SUPER_USUARIO_ROLE_NAME)
export class BiiPlataformaController {
  constructor(
    private readonly importarItbiUseCase: ImportarItbiUseCase,
    private readonly listImportacoesItbiUseCase: ListImportacoesItbiUseCase,
    private readonly iniciarGeocodificacaoItbiUseCase: IniciarGeocodificacaoItbiUseCase,
    private readonly getGeocodificacaoItbiUseCase: GetGeocodificacaoItbiUseCase,
  ) {}

  // POST /bii-plataforma/itbi/importar - multipart "file" (.xlsx ate 120 MB)
  // + campo "ano". 202 com { importacaoId }; processa em segundo plano.
  // "ano" e lido cru (nao por DTO): erro de validacao depois do multer
  // deixaria o temporario no disco - o use case valida e apaga.
  @Post('itbi/importar')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(ItbiUploadTamanhoGuard, BiiItbiImportarLimiteGuard)
  @UseInterceptors(FileInterceptor('file', opcoesMulterItbi))
  async importar(
    @UploadedFile() arquivo: ArquivoItbiUpload | undefined,
    @Body('ano') ano: unknown,
    @Req() req: Request,
  ) {
    return this.importarItbiUseCase.execute({
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      arquivo,
      ano,
    });
  }

  @Get('itbi/importacoes')
  async importacoes(@Req() req: Request) {
    return this.listImportacoesItbiUseCase.execute({ requesterRole: req.user!.role });
  }

  // POST /bii-plataforma/itbi/geocodificar - 202 com o progresso inicial
  // (enfileirados). Um job por vez (409).
  @Post('itbi/geocodificar')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  async geocodificar(@Body() dto: GeocodificarItbiDto, @Req() req: Request) {
    return this.iniciarGeocodificacaoItbiUseCase.execute({
      requesterRole: req.user!.role,
      ceps: dto.ceps,
      bairros: dto.bairros,
      max: dto.max,
    });
  }

  @Get('itbi/geocodificacao')
  async geocodificacao(@Req() req: Request) {
    return this.getGeocodificacaoItbiUseCase.execute({ requesterRole: req.user!.role });
  }
}
