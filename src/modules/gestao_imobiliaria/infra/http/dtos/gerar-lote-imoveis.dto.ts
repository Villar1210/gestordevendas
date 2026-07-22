// src/modules/gestao_imobiliaria/infra/http/dtos/gerar-lote-imoveis.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UnidadePadraoDto {
  @IsInt()
  @IsPositive({ message: 'posicao deve ser um numero positivo.' })
  posicao!: number;

  @IsString()
  @MinLength(1, { message: 'Informe a tipologia da unidade.' })
  tipologia!: string;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsInt()
  dormitorios?: number;
}

export class GerarLoteImoveisDto {
  @IsString()
  @MinLength(1, { message: 'Informe o bloco.' })
  bloco!: string;

  @IsInt()
  andarInicial!: number;

  @IsInt()
  andarFinal!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma unidade por andar.' })
  @ValidateNested({ each: true })
  @Type(() => UnidadePadraoDto)
  unidadesPorAndar!: UnidadePadraoDto[];
}
