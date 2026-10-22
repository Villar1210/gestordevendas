// src/modules/bii/infra/http/dtos/viabilidade.dto.ts - corpo de POST /bii/viabilidade.
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;
const NUM = { allowNaN: false, allowInfinity: false };

export class TipologiaViabilidadeDto {
  @IsString({ message: 'Descreva cada tipologia.' })
  @MinLength(1, { message: 'Descreva cada tipologia.' })
  @MaxLength(100, { message: 'A descrição pode ter no máximo 100 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'A descrição tem caracteres inválidos.' })
  descricao!: string;

  @IsNumber(NUM, { message: 'A área privativa deve ser um número.' })
  @Min(10, { message: 'A área privativa mínima é 10 m².' })
  @Max(1000, { message: 'A área privativa máxima é 1.000 m².' })
  areaPrivativa!: number;

  @IsNumber(NUM, { message: 'O preço deve ser um número.' })
  @Min(10_000, { message: 'O preço mínimo é R$ 10 mil.' })
  @Max(100_000_000, { message: 'O preço máximo é R$ 100 milhões.' })
  preco!: number;
}

export class PremissasDto {
  @IsOptional()
  @IsNumber(NUM, { message: 'A entrada deve ser um número.' })
  @Min(0, { message: 'A entrada mínima é 0%.' })
  @Max(90, { message: 'A entrada máxima é 90%.' })
  entradaPercentual?: number;

  @IsOptional()
  @IsInt({ message: 'O prazo deve ser um número inteiro de meses.' })
  @Min(60, { message: 'O prazo mínimo é 60 meses.' })
  @Max(420, { message: 'O prazo máximo é 420 meses (35 anos).' })
  prazoMeses?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'O comprometimento deve ser um número.' })
  @Min(10, { message: 'O comprometimento mínimo é 10%.' })
  @Max(50, { message: 'O comprometimento máximo é 50%.' })
  comprometimentoPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'Os juros devem ser um número.' })
  @Min(0, { message: 'Os juros não podem ser negativos.' })
  @Max(30, { message: 'Os juros podem ser no máximo 30% ao ano.' })
  jurosAnual?: number | null;
}

export class CalcularViabilidadeDto {
  @IsArray({ message: 'Informe as tipologias como lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma tipologia.' })
  @ArrayMaxSize(20, { message: 'Informe no máximo 20 tipologias.' })
  @ValidateNested({ each: true })
  @Type(() => TipologiaViabilidadeDto)
  tipologias!: TipologiaViabilidadeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PremissasDto)
  premissas?: PremissasDto;
}
