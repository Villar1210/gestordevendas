import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { FINALIDADE_VALUES, STATUS_VALUES, TIPO_VALUES } from './create-imovel.dto';

export class UpdateImovelDto {
  @IsOptional()
  @IsString()
  empreendimentoId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe um titulo para o imovel.' })
  title?: string;

  @IsOptional()
  @IsIn(TIPO_VALUES, { message: `tipo deve ser um de: ${TIPO_VALUES.join(', ')}` })
  tipo?: string;

  @IsOptional()
  @IsIn(FINALIDADE_VALUES, {
    message: `finalidade deve ser um de: ${FINALIDADE_VALUES.join(', ')}`,
  })
  finalidade?: string;

  @IsOptional()
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @IsNumber()
  rentPrice?: number | null;

  @IsOptional()
  @IsNumber()
  area?: number | null;

  @IsOptional()
  @IsInt()
  bedrooms?: number | null;

  @IsOptional()
  @IsInt()
  bathrooms?: number | null;

  @IsOptional()
  @IsInt()
  parkingSpots?: number | null;

  @IsOptional()
  @IsString()
  rua?: string | null;

  @IsOptional()
  @IsString()
  numero?: string | null;

  @IsOptional()
  @IsString()
  complemento?: string | null;

  @IsOptional()
  @IsString()
  bairro?: string | null;

  @IsOptional()
  @IsString()
  cidade?: string | null;

  @IsOptional()
  @IsString()
  uf?: string | null;

  @IsOptional()
  @IsString()
  cep?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(STATUS_VALUES, { message: `status deve ser um de: ${STATUS_VALUES.join(', ')}` })
  status?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
