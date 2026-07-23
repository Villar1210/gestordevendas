// src/modules/gestao_imobiliaria/infra/http/dtos/reorder-empreendimento-photos.dto.ts
import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';
import { EMPREENDIMENTO_PHOTO_CATEGORIAS } from '../../../domain/repositories/empreendimento-repository.interface';

export class ReorderEmpreendimentoPhotosDto {
  @IsIn(EMPREENDIMENTO_PHOTO_CATEGORIAS, {
    message: `categoria deve ser uma de: ${EMPREENDIMENTO_PHOTO_CATEGORIAS.join(', ')}`,
  })
  categoria!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoIds!: string[];
}
