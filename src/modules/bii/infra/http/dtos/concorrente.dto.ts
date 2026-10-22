// src/modules/bii/infra/http/dtos/concorrente.dto.ts
// Corpo de POST/PATCH /bii/concorrentes. Validacao de formato aqui; regras de
// negocio (faixas, precoAte >= precoDe, vendidas <= total, URL https) no
// dominio (concorrente.ts), chamadas pelo use case.
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { FASES_CONCORRENTE, MAX_TIPOLOGIAS } from '../../../domain/services/concorrente';

// Sem quebra de linha/controle (observacoes aceita quebra de linha).
const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;
const SEM_CONTROLE_EXCETO_LINHA = /^[^\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]*$/;
const NUM = { allowNaN: false, allowInfinity: false };

export class TipologiaDto {
  @IsString({ message: 'Descreva cada tipologia.' })
  @MinLength(1, { message: 'Descreva cada tipologia.' })
  @MaxLength(100, { message: 'A descrição da tipologia pode ter no máximo 100 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'A descrição da tipologia tem caracteres inválidos.' })
  descricao!: string;

  @IsOptional()
  @IsInt({ message: 'Dormitórios deve ser um número inteiro.' })
  @Min(0, { message: 'Dormitórios não pode ser negativo.' })
  @Max(10, { message: 'Dormitórios pode ser no máximo 10.' })
  dormitorios?: number | null;

  @IsNumber(NUM, { message: 'A área privativa deve ser um número.' })
  @Min(10, { message: 'A área privativa mínima é 10 m².' })
  @Max(1000, { message: 'A área privativa máxima é 1.000 m².' })
  areaPrivativa!: number;

  @IsNumber(NUM, { message: 'O preço deve ser um número.' })
  @Min(10_000, { message: 'O preço mínimo é R$ 10 mil.' })
  @Max(100_000_000, { message: 'O preço máximo é R$ 100 milhões.' })
  precoDe!: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'O preço "até" deve ser um número.' })
  @Min(10_000, { message: 'O preço mínimo é R$ 10 mil.' })
  @Max(100_000_000, { message: 'O preço máximo é R$ 100 milhões.' })
  precoAte?: number | null;
}

export class ConcorrenteDto {
  @IsString({ message: 'Informe o nome do empreendimento.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(150, { message: 'O nome pode ter no máximo 150 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'O nome tem caracteres inválidos.' })
  nome!: string;

  @IsOptional()
  @IsString({ message: 'A construtora deve ser um texto.' })
  @MaxLength(150, { message: 'A construtora pode ter no máximo 150 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'A construtora tem caracteres inválidos.' })
  construtora?: string | null;

  @IsString({ message: 'Informe o endereço como texto.' })
  @MinLength(5, { message: 'Informe um endereço com pelo menos 5 caracteres.' })
  @MaxLength(200, { message: 'O endereço pode ter no máximo 200 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'O endereço tem caracteres inválidos.' })
  endereco!: string;

  @IsOptional()
  @IsNumber(NUM, { message: 'Latitude inválida.' })
  @Min(-90, { message: 'Latitude inválida.' })
  @Max(90, { message: 'Latitude inválida.' })
  latitude?: number | null;

  @IsOptional()
  @IsNumber(NUM, { message: 'Longitude inválida.' })
  @Min(-180, { message: 'Longitude inválida.' })
  @Max(180, { message: 'Longitude inválida.' })
  longitude?: number | null;

  @IsIn(FASES_CONCORRENTE, { message: 'fase deve ser lancamento, obras ou pronto.' })
  fase!: string;

  @IsOptional()
  @IsString({ message: 'Data de lançamento inválida.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a data de lançamento no formato AAAA-MM-DD.' })
  dataLancamento?: string | null;

  @IsOptional()
  @IsInt({ message: 'O total de unidades deve ser um número inteiro.' })
  @Min(1, { message: 'O total de unidades deve ser maior que zero.' })
  @Max(100_000, { message: 'O total de unidades pode ser no máximo 100.000.' })
  totalUnidades?: number | null;

  @IsOptional()
  @IsInt({ message: 'As unidades vendidas devem ser um número inteiro.' })
  @Min(0, { message: 'As unidades vendidas não podem ser negativas.' })
  @Max(100_000, { message: 'As unidades vendidas podem ser no máximo 100.000.' })
  unidadesVendidas?: number | null;

  @IsOptional()
  @IsString({ message: 'A fonte deve ser um texto.' })
  @MaxLength(120, { message: 'A fonte pode ter no máximo 120 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'A fonte tem caracteres inválidos.' })
  fonte?: string | null;

  @IsOptional()
  @IsString({ message: 'O link da fonte deve ser um texto.' })
  @MaxLength(500, { message: 'O link da fonte pode ter no máximo 500 caracteres.' })
  fonteUrl?: string | null;

  @IsOptional()
  @IsString({ message: 'As observações devem ser um texto.' })
  @MaxLength(1000, { message: 'As observações podem ter no máximo 1.000 caracteres.' })
  @Matches(SEM_CONTROLE_EXCETO_LINHA, { message: 'As observações têm caracteres inválidos.' })
  observacoes?: string | null;

  @IsArray({ message: 'Informe as tipologias como lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma tipologia.' })
  @ArrayMaxSize(MAX_TIPOLOGIAS, { message: `Informe no máximo ${MAX_TIPOLOGIAS} tipologias.` })
  @ValidateNested({ each: true })
  @Type(() => TipologiaDto)
  tipologias!: TipologiaDto[];
}
