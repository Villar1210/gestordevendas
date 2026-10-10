// src/modules/pdf_tools/infra/http/request-size.guard.ts
// Recusa cedo (antes do multer bufferizar tudo em memoria) requisicoes
// cujo Content-Length ja passa do limite total. O limite por arquivo e a
// soma real continuam sendo checados depois do upload. Sem Content-Length
// valido -> 411 LENGTH_REQUIRED.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS, MB } from '../../domain/pdf-tools.limits';

// Folga para os cabecalhos/limites do multipart.
const MULTIPART_OVERHEAD = 1 * MB;

@Injectable()
export class PdfToolsRequestSizeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['content-length'];
    // Sem Content-Length (Transfer-Encoding: chunked) ou valor invalido: nao
    // da para saber o tamanho antes do multer bufferizar - recusa. Navegadores
    // sempre enviam Content-Length em uploads com FormData.
    if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) {
      throw new PdfToolsError(
        'LENGTH_REQUIRED',
        'Envio sem tamanho declarado (Content-Length). Envie o arquivo novamente pelo navegador.',
      );
    }
    const length = Number(raw);
    if (length > PDF_TOOLS_LIMITS.maxRequestBytes + MULTIPART_OVERHEAD) {
      throw new PdfToolsError(
        'TOO_LARGE',
        `O total enviado passa de ${PDF_TOOLS_LIMITS.maxRequestBytes / MB} MB. Envie menos arquivos ou arquivos menores.`,
      );
    }
    return true;
  }
}
