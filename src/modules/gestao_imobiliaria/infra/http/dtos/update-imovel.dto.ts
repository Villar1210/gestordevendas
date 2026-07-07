import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  FINALIDADE_VALUES,
  LOCAL_CHAVES_VALUES,
  STATUS_VALUES,
  TIPO_VALUES,
  USO_VALUES,
} from './create-imovel.dto';

export class UpdateImovelDto {
  @IsOptional()
  @IsString()
  empreendimentoId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe um titulo para o imovel.' })
  title?: string;

  @IsOptional()
  @IsString()
  codigoInterno?: string | null;

  @IsOptional()
  @IsIn(TIPO_VALUES, { message: `tipo deve ser um de: ${TIPO_VALUES.join(', ')}` })
  tipo?: string;

  @IsOptional()
  @IsIn(USO_VALUES, { message: `uso deve ser um de: ${USO_VALUES.join(', ')}` })
  uso?: string | null;

  @IsOptional()
  @IsIn(FINALIDADE_VALUES, {
    message: `finalidade deve ser um de: ${FINALIDADE_VALUES.join(', ')}`,
  })
  finalidade?: string;

  @IsOptional()
  @IsString()
  tags?: string | null;

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
  @IsDateString()
  disponivelApartirDe?: string | null;

  @IsOptional()
  @IsIn(LOCAL_CHAVES_VALUES, {
    message: `localChaves deve ser um de: ${LOCAL_CHAVES_VALUES.join(', ')}`,
  })
  localChaves?: string | null;

  @IsOptional()
  @IsBoolean()
  exclusividade?: boolean;

  @IsOptional()
  @IsString()
  proprietarioNome?: string | null;

  @IsOptional()
  @IsString()
  proprietarioTelefone?: string | null;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
