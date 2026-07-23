// src/modules/gestao_imobiliaria/infra/http/dtos/confirmar-ficha-tecnica.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// Limite defensivo (ver FICHA_TECNICA_MAX_TOKENS/AnthropicConversationService)
// - nenhum PDF de apresentacao de produto real deveria ter mais que isso.
const MAX_TIPOLOGIAS = 100;
const MAX_ITENS_LAZER = 200;

export class TipologiaDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsNumber()
  areaPrivativa?: number | null;

  @IsOptional()
  @IsInt()
  dormitorios?: number | null;
}

export class ConfirmarFichaTecnicaDto {
  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsNumber()
  areaTerreno?: number | null;

  @IsOptional()
  @IsInt()
  totalUnidades?: number | null;

  @IsOptional()
  @IsInt()
  numeroTorres?: number | null;

  @IsOptional()
  @IsInt()
  unidadesPorAndar?: number | null;

  @IsOptional()
  @IsInt()
  gabarito?: number | null;

  @IsOptional()
  @IsInt()
  vagas?: number | null;

  @IsArray()
  @ArrayMaxSize(MAX_ITENS_LAZER)
  @IsString({ each: true })
  itensLazer!: string[];

  @IsArray()
  @ArrayMaxSize(MAX_TIPOLOGIAS)
  @ValidateNested({ each: true })
  @Type(() => TipologiaDto)
  tipologias!: TipologiaDto[];
}
