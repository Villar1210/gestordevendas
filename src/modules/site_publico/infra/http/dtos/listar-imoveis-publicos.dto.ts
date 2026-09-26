import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  FINALIDADE_VALUES,
  TIPO_VALUES,
} from '../../../../gestao_imobiliaria/infra/http/dtos/create-imovel.dto';

export class ListarImoveisPublicosDto {
  @IsOptional()
  @IsIn(FINALIDADE_VALUES.filter((f) => f !== 'ambos'), { message: 'Finalidade inválida.' })
  finalidade?: string;

  @IsOptional()
  @IsIn(TIPO_VALUES, { message: 'Tipo de imóvel inválido.' })
  tipo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  quartosMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bairro?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Empreendimento inválido.' })
  empreendimentoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;
}
