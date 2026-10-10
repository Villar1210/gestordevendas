// src/modules/pdf_tools/infra/http/pdf-tools.controller.ts
// Ferramentas PDF (estilo iLovePDF). Tudo em memoria/pasta temporaria:
// nada vai para o banco nem para /uploads (que e publico).
//
// Contrato com o frontend:
// - upload multipart: campo "file" (1 arquivo) ou "files" (varios, na
//   ordem desejada) + campo de texto "options" com JSON;
// - sucesso: download (Content-Disposition com filename e filename*),
//   header X-Pdf-Tools-Meta com JSON curto (pages, originalSize,
//   resultSize, ...). /extract-text e /capabilities devolvem JSON.
// - erro: JSON { statusCode, code, message } (ver PdfToolsExceptionFilter).
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor, NoFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { PdfToolResult } from '../../application/pdf-tool.types';
import { GetCapabilitiesUseCase } from '../../application/use-cases/get-capabilities.use-case';
import { MergePdfsUseCase } from '../../application/use-cases/merge-pdfs.use-case';
import { SplitPdfUseCase } from '../../application/use-cases/split-pdf.use-case';
import { OrganizePdfUseCase } from '../../application/use-cases/organize-pdf.use-case';
import { RotatePdfUseCase } from '../../application/use-cases/rotate-pdf.use-case';
import { CompressPdfUseCase } from '../../application/use-cases/compress-pdf.use-case';
import { OfficeToPdfUseCase } from '../../application/use-cases/office-to-pdf.use-case';
import { ImagesToPdfUseCase } from '../../application/use-cases/images-to-pdf.use-case';
import { PdfToImagesUseCase } from '../../application/use-cases/pdf-to-images.use-case';
import { AddPageNumbersUseCase } from '../../application/use-cases/add-page-numbers.use-case';
import { AddWatermarkUseCase } from '../../application/use-cases/add-watermark.use-case';
import { ProtectPdfUseCase } from '../../application/use-cases/protect-pdf.use-case';
import { UnlockPdfUseCase } from '../../application/use-cases/unlock-pdf.use-case';
import { ExtractTextUseCase, ExtractTextOutput } from '../../application/use-cases/extract-text.use-case';
import { CreatePdfUseCase } from '../../application/use-cases/create-pdf.use-case';
import { PdfToolsExceptionFilter } from './pdf-tools-exception.filter';
import { PdfToolsRequestSizeGuard } from './request-size.guard';
import {
  requireImages,
  requireOfficeFile,
  requirePdfs,
  requireSingleOrManyPdfs,
  requireSinglePdf,
  UploadedBinary,
} from './file-validation';

const POST_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

function singleUpload() {
  return FileInterceptor('file', {
    limits: { fileSize: PDF_TOOLS_LIMITS.maxFileBytes, files: 1, fields: 5, fieldSize: 1024 * 1024 },
  });
}

function multiUpload(maxFiles: number) {
  // maxCount folgado + limits.files exato: exceder vira "Too many files"
  // (mensagem clara) em vez de "Unexpected field".
  return FilesInterceptor('files', maxFiles + 10, {
    limits: { fileSize: PDF_TOOLS_LIMITS.maxFileBytes, files: maxFiles, fields: 5, fieldSize: 1024 * 1024 },
  });
}

// PDF -> imagem: aceita "file" (1, contrato antigo) OU "files" (1 a 20).
// Mesmo truque do multiUpload: maxCount folgado + limits.files exato.
function singleOrMultiUpload(maxFiles: number) {
  return FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'files', maxCount: maxFiles + 10 },
    ],
    { limits: { fileSize: PDF_TOOLS_LIMITS.maxFileBytes, files: maxFiles, fields: 5, fieldSize: 1024 * 1024 } },
  );
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

@Controller('pdf-tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
@UseFilters(PdfToolsExceptionFilter)
export class PdfToolsController {
  private readonly logger = new Logger('PdfTools');

  constructor(
    private readonly getCapabilities: GetCapabilitiesUseCase,
    private readonly mergePdfs: MergePdfsUseCase,
    private readonly splitPdf: SplitPdfUseCase,
    private readonly organizePdf: OrganizePdfUseCase,
    private readonly rotatePdf: RotatePdfUseCase,
    private readonly compressPdf: CompressPdfUseCase,
    private readonly officeToPdf: OfficeToPdfUseCase,
    private readonly imagesToPdf: ImagesToPdfUseCase,
    private readonly pdfToImages: PdfToImagesUseCase,
    private readonly addPageNumbers: AddPageNumbersUseCase,
    private readonly addWatermark: AddWatermarkUseCase,
    private readonly protectPdf: ProtectPdfUseCase,
    private readonly unlockPdf: UnlockPdfUseCase,
    private readonly extractText: ExtractTextUseCase,
    private readonly createPdf: CreatePdfUseCase,
  ) {}

  // GET /pdf-tools/capabilities -> { office, compress, security, raster }
  @Get('capabilities')
  capabilities() {
    return this.getCapabilities.execute();
  }

  @Post('merge')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(multiUpload(PDF_TOOLS_LIMITS.mergeMaxFiles))
  merge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFiles() files: UploadedBinary[] | undefined,
  ) {
    return this.run(req, res, 'merge', async () => this.mergePdfs.execute({ files: requirePdfs(files) }));
  }

  @Post('split')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  split(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'split', async () => this.splitPdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('organize')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  organize(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'organize', async () => this.organizePdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('rotate')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  rotate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'rotate', async () => this.rotatePdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('compress')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  compress(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'compress', async () => this.compressPdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('office-to-pdf')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  officeToPdfRoute(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
  ) {
    return this.run(req, res, 'office-to-pdf', async () => this.officeToPdf.execute({ file: requireOfficeFile(file) }));
  }

  @Post('images-to-pdf')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(multiUpload(PDF_TOOLS_LIMITS.imagesMaxFiles))
  imagesToPdfRoute(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFiles() files: UploadedBinary[] | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'images-to-pdf', async () =>
      this.imagesToPdf.execute({ files: requireImages(files), options }),
    );
  }

  @Post('pdf-to-images')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleOrMultiUpload(PDF_TOOLS_LIMITS.pdfToImagesMaxFiles))
  pdfToImagesRoute(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFiles() uploads: { file?: UploadedBinary[]; files?: UploadedBinary[] } | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'pdf-to-images', async () =>
      this.pdfToImages.execute({ files: requireSingleOrManyPdfs(uploads), options }),
    );
  }

  @Post('page-numbers')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  pageNumbers(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'page-numbers', async () =>
      this.addPageNumbers.execute({ file: requireSinglePdf(file), options }),
    );
  }

  @Post('watermark')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  watermark(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'watermark', async () => this.addWatermark.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('protect')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  protect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'protect', async () => this.protectPdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('unlock')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  unlock(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body('options') options: unknown,
  ) {
    return this.run(req, res, 'unlock', async () => this.unlockPdf.execute({ file: requireSinglePdf(file), options }));
  }

  @Post('extract-text')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseGuards(PdfToolsRequestSizeGuard)
  @UseInterceptors(singleUpload())
  async extractTextRoute(@Req() req: Request, @UploadedFile() file: UploadedBinary | undefined): Promise<ExtractTextOutput> {
    const started = Date.now();
    const pdf = requireSinglePdf(file);
    const result = await this.extractText.execute({ file: pdf });
    this.log(req, 'extract-text', started, pdf.buffer.length, Buffer.byteLength(result.text, 'utf8'));
    return result;
  }

  // POST /pdf-tools/create - sem arquivo. Aceita corpo JSON OU multipart
  // com o campo de texto "options" (JSON). O frontend usa multipart: o
  // body-parser JSON global do Express tem limite de 100 KB, e 50.000
  // caracteres com acentos/travessoes/simbolos (2-3 bytes em UTF-8)
  // passavam disso -> 413 "request entity too large" em ingles.
  @Post('create')
  @HttpCode(200)
  @Throttle(POST_THROTTLE)
  @UseInterceptors(NoFilesInterceptor({ limits: { files: 0, fields: 5, fieldSize: 1024 * 1024 } }))
  create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: Record<string, unknown>) {
    const payload = req.is('multipart/form-data') ? body?.options : body;
    return this.run(req, res, 'create', async () => this.createPdf.execute({ body: payload }));
  }

  // -------------------------------------------------------------------------

  private async run(
    req: Request,
    res: Response,
    tool: string,
    task: () => Promise<PdfToolResult>,
  ): Promise<StreamableFile> {
    const started = Date.now();
    const result = await task();
    const originalSize = typeof result.meta.originalSize === 'number' ? result.meta.originalSize : 0;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', String(result.data.length));
    res.setHeader('Content-Disposition', contentDisposition(result.fileName));
    res.setHeader('X-Pdf-Tools-Meta', JSON.stringify(result.meta));
    // CORS global (main.ts) nao configura exposedHeaders: expoe aqui.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Pdf-Tools-Meta');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    this.log(req, tool, started, originalSize, result.data.length);
    return new StreamableFile(result.data);
  }

  // Nunca loga senha, nome de arquivo nem conteudo - so metadados.
  private log(req: Request, tool: string, started: number, inputBytes: number, outputBytes: number): void {
    this.logger.log(
      `tool=${tool} tenant=${req.user?.tenantId ?? '-'} user=${req.user?.id ?? '-'} ms=${Date.now() - started} in=${inputBytes} out=${outputBytes}`,
    );
  }
}
