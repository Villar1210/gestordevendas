// src/modules/gestao_imobiliaria/infra/http/dtos/confirmar-ficha-tecnica.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Limite defensivo (ver FICHA_TECNICA_MAX_TOKENS/AnthropicConversationService)
// - nenhum PDF de apresentacao de produto real deveria ter mais que isso.
const MAX_TIPOLOGIAS = 100;
// Revisao de seguranca: tamanhos maximos (antes so o tipo era validado).
// Usado tambem pelo book (ConfirmarBookDto.ficha). Itens de lazer: era 200.
const MAX_ITENS_LAZER = 100;
const MAX_CHARS_ITEM_LAZER = 120;
const MAX_CHARS_DESCRICAO = 5000;
const MAX_CHARS_NOME_TIPOLOGIA = 150;
const MAX_INT = 2147483647; // INTEGER do Postgres
// 100 km2 em m2: muito acima de qualquer terreno real, abaixo do overflow.
const MAX_AREA_M2 = 100_000_000;

export class TipologiaDto {
  @IsString()
  @MaxLength(MAX_CHARS_NOME_TIPOLOGIA)
  nome!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AREA_M2)
  areaPrivativa?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  dormitorios?: number | null;
}

export class ConfirmarFichaTecnicaDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CHARS_DESCRICAO)
  descricao?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AREA_M2)
  areaTerreno?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  totalUnidades?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  numeroTorres?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  unidadesPorAndar?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  gabarito?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  vagas?: number | null;

  @IsArray()
  @ArrayMaxSize(MAX_ITENS_LAZER)
  @IsString({ each: true })
  @MaxLength(MAX_CHARS_ITEM_LAZER, { each: true })
  itensLazer!: string[];

  @IsArray()
  @ArrayMaxSize(MAX_TIPOLOGIAS)
  @ValidateNested({ each: true })
  @Type(() => TipologiaDto)
  tipologias!: TipologiaDto[];
}
