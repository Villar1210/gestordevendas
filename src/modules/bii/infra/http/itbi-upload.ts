// src/modules/bii/infra/http/itbi-upload.ts
// Upload da planilha do ITBI (Super Usuario). Ordem na rota: throttle global
// -> JwtAuthGuard/RolesGuard -> tamanho declarado (Content-Length, antes do
// multer) -> 1 upload por vez no processo -> multer em DISCO TEMPORARIO
// (pasta 0o700 fora de /uploads, que e publico; nome aleatorio, nunca o nome
// do usuario) com limite de 120 MB e 1 arquivo. O use case apaga o arquivo em
// qualquer erro; o importador apaga no finally. Arquivos esquecidos (processo
// caiu no meio) sao varridos depois de 6 h.
import { randomUUID } from 'crypto';
import { createWriteStream, mkdirSync, readdirSync, statSync, unlink, unlinkSync } from 'fs';
import { Readable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { Request } from 'express';
import { LimiteConcorrenciaGuard } from '../../../../shared/infra/http/limite-concorrencia';

const MB = 1024 * 1024;
export const ITBI_UPLOAD_MAX_BYTES = 120 * MB;
const FOLGA_MULTIPART = 1 * MB;
export const PASTA_TEMP_ITBI = join(tmpdir(), 'gestordevendas-bii-itbi');
const VALIDADE_TEMP_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class ItbiUploadTamanhoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const bruto = req.headers['content-length'];
    if (typeof bruto !== 'string' || !/^\d+$/.test(bruto.trim())) {
      throw new HttpException(
        'Envio sem tamanho declarado (Content-Length). Envie o arquivo novamente pelo navegador.',
        HttpStatus.LENGTH_REQUIRED,
      );
    }
    if (Number(bruto) > ITBI_UPLOAD_MAX_BYTES + FOLGA_MULTIPART) {
      throw new PayloadTooLargeException(`A planilha pode ter no máximo ${ITBI_UPLOAD_MAX_BYTES / MB} MB.`);
    }
    return true;
  }
}

// Exportado para o meta-teste reconhecer (aditivo aos guards da classe).
export const BiiItbiImportarLimiteGuard = LimiteConcorrenciaGuard('bii-itbi-importar', 1);

export function varrerTemporariosAntigos(agora = Date.now()): void {
  try {
    for (const nome of readdirSync(PASTA_TEMP_ITBI)) {
      const caminho = join(PASTA_TEMP_ITBI, nome);
      try {
        if (agora - statSync(caminho).mtimeMs > VALIDADE_TEMP_MS) unlinkSync(caminho);
      } catch {
        // ignorado
      }
    }
  } catch {
    // pasta ainda nao existe
  }
}

// Arquivo como o multer entrega ao controller (sem @types/multer no projeto).
export interface ArquivoItbiUpload {
  path: string;
  originalname: string;
  size: number;
}

// Storage engine do multer escrito aqui (interface _handleFile/_removeFile):
// grava direto em PASTA_TEMP_ITBI com modo 0o600 desde a criacao e nome
// aleatorio. Em erro do multer (ex.: passou de 120 MB), _removeFile apaga.
export const storageTempItbi = {
  _handleFile(
    _req: unknown,
    file: { stream: Readable },
    cb: (erro: Error | null, info?: { path: string; size: number }) => void,
  ) {
    try {
      mkdirSync(PASTA_TEMP_ITBI, { recursive: true, mode: 0o700 });
      varrerTemporariosAntigos();
    } catch (erro) {
      return cb(erro as Error);
    }
    const caminho = join(PASTA_TEMP_ITBI, `${randomUUID()}.xlsx`);
    const destino = createWriteStream(caminho, { mode: 0o600, flags: 'wx' });
    let size = 0;
    let terminou = false;
    const falhar = (erro: Error) => {
      if (terminou) return;
      terminou = true;
      destino.destroy();
      unlink(caminho, () => cb(erro));
    };
    file.stream.on('data', (pedaco: Buffer) => {
      size += pedaco.length;
    });
    file.stream.on('error', falhar);
    destino.on('error', falhar);
    destino.on('finish', () => {
      if (terminou) return;
      terminou = true;
      cb(null, { path: caminho, size });
    });
    file.stream.pipe(destino);
  },
  _removeFile(_req: unknown, file: { path?: string }, cb: (erro: Error | null) => void) {
    if (!file.path) return cb(null);
    unlink(file.path, () => cb(null));
  },
};

export const opcoesMulterItbi = {
  storage: storageTempItbi,
  limits: { fileSize: ITBI_UPLOAD_MAX_BYTES, files: 1, fields: 5, fieldSize: 1024, parts: 7 },
};
