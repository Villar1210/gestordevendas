// src/modules/pdf_tools/infra/http/pdf-tools-exception.filter.ts
// Formato de erro JSON unico do modulo: { statusCode, code, message }.
// - PdfToolsError -> 400/413/422/503/500 conforme o code;
// - HttpException do Nest/multer -> mesmo status, mensagens do multer
//   traduzidas para portugues;
// - qualquer outro erro -> 500 generico (nunca vaza stack/stderr).
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PdfToolsError, PdfToolsErrorCode } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS, MB } from '../../domain/pdf-tools.limits';

const STATUS_BY_CODE: Record<PdfToolsErrorCode, number> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  ENCRYPTED_PDF: HttpStatus.UNPROCESSABLE_ENTITY,
  WRONG_PASSWORD: HttpStatus.UNPROCESSABLE_ENTITY,
  TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  LENGTH_REQUIRED: HttpStatus.LENGTH_REQUIRED,
  TOOL_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PROCESSING_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
};

const GENERIC_500 = 'Não foi possível processar o arquivo. Tente novamente.';

function translateHttpMessage(status: number, message: string): { code: string; message: string } {
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    return { code: 'TOO_LARGE', message: `Cada arquivo pode ter no máximo ${PDF_TOOLS_LIMITS.maxFileBytes / MB} MB.` };
  }
  if (status === HttpStatus.BAD_REQUEST) {
    if (/too many files/i.test(message)) return { code: 'INVALID_INPUT', message: 'Arquivos demais nesta requisição.' };
    if (/unexpected field/i.test(message)) {
      return { code: 'INVALID_INPUT', message: 'Campo de arquivo inesperado. Use "file" ou "files" conforme a ferramenta.' };
    }
    if (/multipart|boundary/i.test(message)) return { code: 'INVALID_INPUT', message: 'Envio de arquivo inválido.' };
    return { code: 'INVALID_INPUT', message };
  }
  if (status === HttpStatus.TOO_MANY_REQUESTS) return { code: 'TOO_MANY_REQUESTS', message };
  if (status === HttpStatus.UNAUTHORIZED) return { code: 'UNAUTHORIZED', message };
  if (status === HttpStatus.FORBIDDEN) return { code: 'FORBIDDEN', message };
  return { code: 'HTTP_ERROR', message };
}

@Catch()
export class PdfToolsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PdfTools');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    let status: number;
    let body: { statusCode: number; code: string; message: string };

    if (exception instanceof PdfToolsError) {
      status = STATUS_BY_CODE[exception.code];
      const message = status >= 500 && exception.code === 'PROCESSING_FAILED' ? exception.message || GENERIC_500 : exception.message;
      body = { statusCode: status, code: exception.code, message };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'string'
          ? response
          : Array.isArray((response as { message?: unknown }).message)
            ? ((response as { message: string[] }).message).join('; ')
            : String((response as { message?: unknown }).message ?? exception.message);
      if (status >= 500) {
        body = { statusCode: status, code: 'PROCESSING_FAILED', message: GENERIC_500 };
      } else {
        body = { statusCode: status, ...translateHttpMessage(status, raw) };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      // Loga so o tipo/mensagem (sem conteudo de arquivo, sem senha).
      this.logger.error(`Erro inesperado: ${exception instanceof Error ? `${exception.name}: ${exception.message}` : 'desconhecido'}`);
      body = { statusCode: status, code: 'PROCESSING_FAILED', message: GENERIC_500 };
    }

    res.status(status).json(body);
  }
}
