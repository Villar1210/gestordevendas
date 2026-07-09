import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TIPO_CONTRATO_VALUES = ['venda', 'locacao'];

export class NovoProprietarioDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do proprietario.' })
  nome!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o telefone do proprietario.' })
  telefone!: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string;
}

export class NovoInquilinoCompradorDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome.' })
  nome!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o telefone.' })
  telefone!: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string;
}

export class CreateContratoDto {
  @IsString()
  @MinLength(1, { message: 'Selecione um imovel.' })
  imovelId!: string;

  @IsOptional()
  @IsString()
  proprietarioId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NovoProprietarioDto)
  proprietario?: NovoProprietarioDto;

  @IsOptional()
  @IsString()
  inquilinoCompradorId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NovoInquilinoCompradorDto)
  inquilinoComprador?: NovoInquilinoCompradorDto;

  @IsIn(TIPO_CONTRATO_VALUES, {
    message: `tipo deve ser um de: ${TIPO_CONTRATO_VALUES.join(', ')}`,
  })
  tipo!: string;

  @IsNumber()
  valor!: number;

  @IsDateString()
  dataInicio!: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimento?: number;
}
