import { IsEmail, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export const STATUS_ANALISE_CREDITO_VALUES = [
  'nao_iniciada',
  'em_analise',
  'aprovado',
  'reprovado',
];

export class UpdateInquilinoCompradorDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe o nome.' })
  nome?: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe o telefone.' })
  telefone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string;

  @IsOptional()
  @IsString()
  profissao?: string;

  @IsOptional()
  @IsNumber()
  rendaDeclarada?: number;

  @IsOptional()
  @IsIn(STATUS_ANALISE_CREDITO_VALUES, {
    message: `statusAnaliseCredito deve ser um de: ${STATUS_ANALISE_CREDITO_VALUES.join(', ')}`,
  })
  statusAnaliseCredito?: string;

  @IsOptional()
  @IsString()
  observacoesAnalise?: string;
}
