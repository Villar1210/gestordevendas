// src/modules/edoc/application/services/prepare-envelope-document.service.ts
// Compartilhado por CreateEnvelopeUseCase e UpdateEnvelopeDraftUseCase
// (Fatia 4): valida tamanho/extensao do arquivo enviado e, se nao for
// PDF, converte via IDocumentConverterService antes de calcular o hash -
// assim os dois use cases nunca guardam um documento Word/Excel "cru".
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { IDocumentConverterService } from '../../domain/services/document-converter.interface';

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;
const CONVERTIBLE_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx'];
const CONVERTIBLE_MIMETYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export interface PreparedEnvelopeDocument {
  buffer: Buffer;
  documentHash: string;
  // Nome de arquivo final (extensao trocada para .pdf quando convertido) -
  // os use cases usam isso ao chamar IFileStorageService.upload().
  originalname: string;
}

@Injectable()
export class PrepareEnvelopeDocumentService {
  constructor(
    @Inject('IDocumentConverterService')
    private readonly converterService: IDocumentConverterService,
  ) {}

  async execute(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<PreparedEnvelopeDocument> {
    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('O documento excede o tamanho maximo de 30MB.');
    }

    let pdfBuffer: Buffer;
    if (file.mimetype === 'application/pdf') {
      pdfBuffer = file.buffer;
    } else {
      const extension = file.originalname
        .slice(file.originalname.lastIndexOf('.'))
        .toLowerCase();
      const isConvertible =
        CONVERTIBLE_EXTENSIONS.includes(extension) || CONVERTIBLE_MIMETYPES.includes(file.mimetype);
      if (!isConvertible) {
        throw new BadRequestException(
          'O documento precisa ser PDF, Word (.doc/.docx) ou Excel (.xls/.xlsx).',
        );
      }
      pdfBuffer = await this.converterService.convertToPdf({
        buffer: file.buffer,
        originalname: file.originalname,
      });
    }

    const documentHash = createHash('sha256').update(pdfBuffer).digest('hex');
    const baseName = file.originalname.slice(0, file.originalname.lastIndexOf('.')) || file.originalname;

    return { buffer: pdfBuffer, documentHash, originalname: `${baseName}.pdf` };
  }
}
