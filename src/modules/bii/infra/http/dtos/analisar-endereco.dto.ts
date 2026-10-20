// src/modules/bii/infra/http/dtos/analisar-endereco.dto.ts
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TIPOS_IMOVEL_ANALISE, TipoImovelAnalise } from '../../../domain/services/itbi-classificacao';

// Sem quebra de linha/controle: endereco e so texto, nunca URL.
const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;

export class AnalisarEnderecoDto {
  @IsString()
  @MinLength(5, { message: 'Informe um endereço com pelo menos 5 caracteres.' })
  @MaxLength(200, { message: 'O endereço pode ter no máximo 200 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'O endereço tem caracteres inválidos.' })
  endereco!: string;

  @IsOptional()
  @IsIn([500, 1000, 2000], { message: 'raioMetros deve ser 500, 1000 ou 2000.' })
  raioMetros?: number;

  @IsOptional()
  @IsIn([6, 12, 24, 36], { message: 'meses deve ser 6, 12, 24 ou 36.' })
  meses?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100_000)
  areaMin?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100_000)
  areaMax?: number;

  @IsOptional()
  @IsIn(TIPOS_IMOVEL_ANALISE, { message: 'tipo deve ser residencial, apartamento, casa ou todos.' })
  tipo?: TipoImovelAnalise;

  @IsOptional()
  @IsBoolean()
  somenteCompraVenda?: boolean;
}

export class GeocodificarItbiDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^\d{5}$/, { each: true, message: 'Use prefixos de CEP com 5 dígitos (ex.: 03277).' })
  ceps?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @Matches(SEM_CONTROLE, { each: true })
  bairros?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  max?: number;
}
