// src/modules/gestao_imobiliaria/infra/http/dtos/upload-empreendimento-photo.dto.ts
import { IsIn } from 'class-validator';
import { EMPREENDIMENTO_PHOTO_CATEGORIAS } from '../../../domain/repositories/empreendimento-repository.interface';

export class UploadEmpreendimentoPhotoDto {
  @IsIn(EMPREENDIMENTO_PHOTO_CATEGORIAS, {
    message: `categoria deve ser uma de: ${EMPREENDIMENTO_PHOTO_CATEGORIAS.join(', ')}`,
  })
  categoria!: string;
}
