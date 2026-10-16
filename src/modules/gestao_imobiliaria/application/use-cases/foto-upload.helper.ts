// src/modules/gestao_imobiliaria/application/use-cases/foto-upload.helper.ts
// Valida a foto pelos bytes (domain/services/foto-upload.ts) e devolve o
// arquivo pronto para o storage: nome "foto.<ext do tipo real>" e mimetype
// do tipo real. Qualquer outra coisa (ou nenhum arquivo) -> 400.
import { BadRequestException } from '@nestjs/common';
import { UploadFileInput } from '../../../../shared/domain/services/file-storage.interface';
import { MENSAGEM_FOTO_INVALIDA, detectarTipoFoto } from '../../domain/services/foto-upload';

export function fotoValidadaParaUpload(file: { buffer?: Buffer } | null | undefined): UploadFileInput {
  const tipo = detectarTipoFoto(file?.buffer);
  if (!file?.buffer || !tipo) {
    throw new BadRequestException(MENSAGEM_FOTO_INVALIDA);
  }
  return { buffer: file.buffer, originalname: `foto.${tipo.extensao}`, mimetype: tipo.mimetype };
}
