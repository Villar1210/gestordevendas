// src/modules/gestao_imobiliaria/infra/services/pdf-parse-pdf-reader.service.ts
// Camada de INFRA: unico lugar do modulo que sabe que existe pdf-parse
// (mesmo padrao de ExceljsCsvSpreadsheetReaderService/LibreOfficeConverterService).
import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { IPdfReaderService } from '../../domain/services/pdf-reader.interface';

@Injectable()
export class PdfParsePdfReaderService implements IPdfReaderService {
  async extractText(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const nomeArquivo = file.originalname.toLowerCase();
    if (!nomeArquivo.endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Envie um arquivo .pdf.');
    }

    const parser = new PDFParse({ data: file.buffer });
    try {
      const resultado = await parser.getText();
      return resultado.text;
    } catch (error) {
      throw new BadRequestException(
        `Nao foi possivel ler o arquivo PDF: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
      );
    } finally {
      await parser.destroy();
    }
  }
}
