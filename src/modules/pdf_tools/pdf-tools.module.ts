// src/modules/pdf_tools/pdf-tools.module.ts
// Modulo Ferramentas PDF (estilo iLovePDF). Sem banco, sem /uploads:
// todo processamento e em memoria ou em pasta temporaria privada. Isolado
// dos demais modulos (nao importa nada do edoc nem de gestao_imobiliaria).
import { Module } from '@nestjs/common';
import { PdfToolsController } from './infra/http/pdf-tools.controller';
import { PdfToolsRequestSizeGuard } from './infra/http/request-size.guard';
import { GetCapabilitiesUseCase } from './application/use-cases/get-capabilities.use-case';
import { MergePdfsUseCase } from './application/use-cases/merge-pdfs.use-case';
import { SplitPdfUseCase } from './application/use-cases/split-pdf.use-case';
import { OrganizePdfUseCase } from './application/use-cases/organize-pdf.use-case';
import { RotatePdfUseCase } from './application/use-cases/rotate-pdf.use-case';
import { CompressPdfUseCase } from './application/use-cases/compress-pdf.use-case';
import { OfficeToPdfUseCase } from './application/use-cases/office-to-pdf.use-case';
import { ImagesToPdfUseCase } from './application/use-cases/images-to-pdf.use-case';
import { PdfToImagesUseCase } from './application/use-cases/pdf-to-images.use-case';
import { AddPageNumbersUseCase } from './application/use-cases/add-page-numbers.use-case';
import { AddWatermarkUseCase } from './application/use-cases/add-watermark.use-case';
import { ProtectPdfUseCase } from './application/use-cases/protect-pdf.use-case';
import { UnlockPdfUseCase } from './application/use-cases/unlock-pdf.use-case';
import { ExtractTextUseCase } from './application/use-cases/extract-text.use-case';
import { CreatePdfUseCase } from './application/use-cases/create-pdf.use-case';
import { PdfLibEngineService } from './infra/services/pdf-lib-engine.service';
import { LibreOfficeOfficeConverterService } from './infra/services/libreoffice-office-converter.service';
import { GhostscriptCompressorService } from './infra/services/ghostscript-compressor.service';
import { QpdfSecurityService } from './infra/services/qpdf-security.service';
import { PdfParseRasterizerService } from './infra/services/pdf-parse-rasterizer.service';
import { PdfParseTextExtractorService } from './infra/services/pdf-parse-text-extractor.service';
import { StoreZipBuilderService } from './infra/services/store-zip-builder.service';
import { BinaryAvailabilityService } from './infra/services/binary-availability.service';

@Module({
  controllers: [PdfToolsController],
  providers: [
    PdfToolsRequestSizeGuard,
    GetCapabilitiesUseCase,
    MergePdfsUseCase,
    SplitPdfUseCase,
    OrganizePdfUseCase,
    RotatePdfUseCase,
    CompressPdfUseCase,
    OfficeToPdfUseCase,
    ImagesToPdfUseCase,
    PdfToImagesUseCase,
    AddPageNumbersUseCase,
    AddWatermarkUseCase,
    ProtectPdfUseCase,
    UnlockPdfUseCase,
    ExtractTextUseCase,
    CreatePdfUseCase,
    // Inversao de dependencia: os casos de uso pedem a INTERFACE; aqui
    // entregamos a implementacao concreta. Trocar o motor (ex.: um servico
    // de conversao em nuvem) so mexe nestas linhas.
    { provide: 'IPdfEngine', useClass: PdfLibEngineService },
    { provide: 'IOfficeConverter', useClass: LibreOfficeOfficeConverterService },
    { provide: 'IPdfCompressor', useClass: GhostscriptCompressorService },
    { provide: 'IPdfSecurity', useClass: QpdfSecurityService },
    { provide: 'IPdfRasterizer', useClass: PdfParseRasterizerService },
    { provide: 'IPdfTextExtractor', useClass: PdfParseTextExtractorService },
    { provide: 'IZipBuilder', useClass: StoreZipBuilderService },
    { provide: 'IToolAvailability', useClass: BinaryAvailabilityService },
  ],
})
export class PdfToolsModule {}
