// src/modules/gestao_imobiliaria/infra/http/dtos/criar-imoveis-lote.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateImovelDto } from './create-imovel.dto';

export const TIPO_ITEM_VALUES = ['unidade', 'vaga_avulsa'];
export const ENQUADRAMENTO_VALUES = ['his2', 'hmp', 'r2v', 'nenhum'];

// Mesma forma do CreateImovelDto (title/tipo/finalidade obrigatorios, resto
// opcional) + os campos novos da Fatia 1 que so o cadastro em lote usa por
// enquanto (POST /imoveis e PATCH /imoveis/:id continuam sem eles - fora do
// escopo desta fatia).
export class CreateImovelLoteItemDto extends CreateImovelDto {
  @IsOptional()
  @IsIn(TIPO_ITEM_VALUES, { message: `tipoItem deve ser um de: ${TIPO_ITEM_VALUES.join(', ')}` })
  tipoItem?: string;

  @IsOptional()
  @IsString()
  identificadorExterno?: string;

  @IsOptional()
  @IsString()
  bloco?: string;

  @IsOptional()
  @IsInt()
  andar?: number;

  @IsOptional()
  @IsInt()
  numeroNoAndar?: number;

  @IsOptional()
  @IsIn(ENQUADRAMENTO_VALUES, {
    message: `enquadramento deve ser um de: ${ENQUADRAMENTO_VALUES.join(', ')}`,
  })
  enquadramento?: string;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;

  @IsOptional()
  @IsNumber()
  valorTabela?: number;

  @IsOptional()
  @IsNumber()
  valorComDesconto?: number;

  @IsOptional()
  @IsInt()
  vagasIncluidas?: number;
}

export class CriarImoveisLoteDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um imovel para criar.' })
  @ValidateNested({ each: true })
  @Type(() => CreateImovelLoteItemDto)
  imoveis!: CreateImovelLoteItemDto[];
}
