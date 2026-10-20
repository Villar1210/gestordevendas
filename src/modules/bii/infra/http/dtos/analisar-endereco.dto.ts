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
  @IsString({ message: 'Informe o endereço como texto.' })
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
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'A área mínima deve ser um número.' })
  @Min(0, { message: 'A área mínima não pode ser negativa.' })
  @Max(100_000, { message: 'A área mínima pode ser no máximo 100.000 m².' })
  areaMin?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'A área máxima deve ser um número.' })
  @Min(0, { message: 'A área máxima não pode ser negativa.' })
  @Max(100_000, { message: 'A área máxima pode ser no máximo 100.000 m².' })
  areaMax?: number;

  @IsOptional()
  @IsIn(TIPOS_IMOVEL_ANALISE, { message: 'tipo deve ser residencial, apartamento, casa ou todos.' })
  tipo?: TipoImovelAnalise;

  @IsOptional()
  @IsBoolean({ message: 'somenteCompraVenda deve ser verdadeiro ou falso.' })
  somenteCompraVenda?: boolean;
}

export class GeocodificarItbiDto {
  @IsOptional()
  @IsArray({ message: 'ceps deve ser uma lista.' })
  @ArrayMaxSize(200, { message: 'Informe no máximo 200 prefixos de CEP.' })
  @IsString({ each: true, message: 'Cada prefixo de CEP deve ser um texto.' })
  @Matches(/^\d{5}$/, { each: true, message: 'Use prefixos de CEP com 5 dígitos (ex.: 03277).' })
  ceps?: string[];

  @IsOptional()
  @IsArray({ message: 'bairros deve ser uma lista.' })
  @ArrayMaxSize(200, { message: 'Informe no máximo 200 bairros.' })
  @IsString({ each: true, message: 'Cada bairro deve ser um texto.' })
  @MaxLength(100, { each: true, message: 'Cada bairro pode ter no máximo 100 caracteres.' })
  @Matches(SEM_CONTROLE, { each: true, message: 'O bairro tem caracteres inválidos.' })
  bairros?: string[];

  @IsOptional()
  @IsInt({ message: 'O máximo deve ser um número inteiro.' })
  @Min(1, { message: 'O mínimo é 1 endereço.' })
  @Max(5000, { message: 'O máximo é 5000 endereços.' })
  max?: number;
}
