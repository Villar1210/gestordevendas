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

export const TIPO_VALUES = ['apartamento', 'casa', 'comercial', 'terreno', 'outro'];
export const FINALIDADE_VALUES = ['venda', 'aluguel', 'ambos'];
export const USO_VALUES = ['residencial', 'comercial'];
export const LOCAL_CHAVES_VALUES = ['imobiliaria', 'proprietario', 'outro'];
export const STATUS_VALUES = [
  'disponivel',
  'reservado',
  'em_negociacao',
  'vendido',
  'bloqueado',
  'em_analise',
  'distrato',
  'ocupado',
  'vago',
  'inativo',
];

export class CreateImovelDto {
  @IsOptional()
  @IsString()
  empreendimentoId?: string;

  @IsString()
  @MinLength(1, { message: 'Informe um titulo para o imovel.' })
  title!: string;

  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsIn(TIPO_VALUES, { message: `tipo deve ser um de: ${TIPO_VALUES.join(', ')}` })
  tipo!: string;

  @IsOptional()
  @IsIn(USO_VALUES, { message: `uso deve ser um de: ${USO_VALUES.join(', ')}` })
  uso?: string;

  @IsIn(FINALIDADE_VALUES, {
    message: `finalidade deve ser um de: ${FINALIDADE_VALUES.join(', ')}`,
  })
  finalidade!: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  rentPrice?: number;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsInt()
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  parkingSpots?: number;

  @IsOptional()
  @IsString()
  rua?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES, { message: `status deve ser um de: ${STATUS_VALUES.join(', ')}` })
  status?: string;

  @IsOptional()
  @IsDateString()
  disponivelApartirDe?: string;

  @IsOptional()
  @IsIn(LOCAL_CHAVES_VALUES, {
    message: `localChaves deve ser um de: ${LOCAL_CHAVES_VALUES.join(', ')}`,
  })
  localChaves?: string;

  @IsOptional()
  @IsBoolean()
  exclusividade?: boolean;

  @IsOptional()
  @IsString()
  proprietarioNome?: string;

  @IsOptional()
  @IsString()
  proprietarioTelefone?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
