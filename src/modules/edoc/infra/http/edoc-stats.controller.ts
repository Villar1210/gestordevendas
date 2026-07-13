// src/modules/edoc/infra/http/edoc-stats.controller.ts
// Controller proprio (nao aninhado em EnvelopeController, que ja usa
// @Controller('edoc/envelopes')) - GET /edoc/stats e uma rota irma de
// /edoc/envelopes/*, nao um recurso dentro dela. Tambem hospeda
// POST /edoc/convert-preview: converte Word/Excel para PDF em memoria
// para preview no Passo 2 do wizard, sem salvar nada em disco/banco.
import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { GetEnvelopeStatsUseCase } from '../../application/use-cases/get-envelope-stats.use-case';
import { PrepareEnvelopeDocumentService } from '../../application/services/prepare-envelope-document.service';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

@Controller('edoc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class EdocStatsController {
  constructor(
    private readonly getEnvelopeStatsUseCase: GetEnvelopeStatsUseCase,
    private readonly prepareEnvelopeDocumentService: PrepareEnvelopeDocumentService,
  ) {}

  // GET /edoc/stats - contagens do dashboard (total, por status)
  @Get('stats')
  async getStats(@Req() req: Request) {
    return this.getEnvelopeStatsUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // POST /edoc/convert-preview - converte Word/Excel para PDF so para
  // preview no Passo 2 do wizard (posicionamento de campos). Nao salva
  // nada em banco ou disco - so devolve os bytes do PDF convertido para
  // o browser renderizar via react-pdf.
  @Post('convert-preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async convertPreview(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
  ): Promise<StreamableFile> {
    if (!file) {
      throw new BadRequestException('Envie o arquivo para converter.');
    }
    const { buffer } = await this.prepareEnvelopeDocumentService.execute(file);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'inline; filename="preview.pdf"',
    });
  }
}
