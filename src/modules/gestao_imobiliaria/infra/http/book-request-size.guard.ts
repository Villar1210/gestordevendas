// src/modules/gestao_imobiliaria/infra/http/book-request-size.guard.ts
// Recusa cedo (antes do multer bufferizar tudo em memoria) um envio de book
// cujo Content-Length ja passa do limite total - com ate 80 imagens, so o
// limite por arquivo do multer nao protege a memoria. Mesma ideia do
// PdfToolsRequestSizeGuard (copiada: um modulo nao importa o outro). Guards
// rodam ANTES dos interceptors (onde o multer le o corpo).
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { Request } from 'express';
import { BOOK_MAX_BYTES } from '../../domain/services/book-empreendimento';

const MB = 1024 * 1024;
// Folga para os cabecalhos/limites do multipart (1 por arquivo, ate 80).
const FOLGA_MULTIPART = 1 * MB;

@Injectable()
export class BookRequestSizeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const bruto = req.headers['content-length'];
    // Sem Content-Length (chunked): nao da para saber o tamanho antes de
    // bufferizar. Navegadores sempre enviam em uploads com FormData.
    if (typeof bruto !== 'string' || !/^\d+$/.test(bruto.trim())) {
      throw new HttpException(
        'Envio sem tamanho declarado (Content-Length). Envie os arquivos novamente pelo navegador.',
        HttpStatus.LENGTH_REQUIRED,
      );
    }
    if (Number(bruto) > BOOK_MAX_BYTES + FOLGA_MULTIPART) {
      throw new PayloadTooLargeException(`O book pode ter no máximo ${BOOK_MAX_BYTES / MB} MB no total.`);
    }
    return true;
  }
}
