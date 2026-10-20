// src/modules/bii/infra/http/dtos/get-painel-vendas.dto.ts
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class GetPainelVendasDto {
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'de deve estar no formato YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'de deve ser uma data válida.' })
  de?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'ate deve estar no formato YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'ate deve ser uma data válida.' })
  ate?: string;

  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  @IsOptional()
  @IsUUID()
  corretorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  origem?: string;
}
