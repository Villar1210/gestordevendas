import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export const TIPO_LANCAMENTO_VALUES = ['receita', 'repasse'];
export const CATEGORIA_LANCAMENTO_VALUES = [
  'aluguel',
  'venda',
  'taxa_administracao',
  'manutencao',
  'outro',
];

export class CreateLancamentoDto {
  @IsOptional()
  @IsString()
  contratoId?: string;

  @IsIn(TIPO_LANCAMENTO_VALUES, {
    message: `tipo deve ser um de: ${TIPO_LANCAMENTO_VALUES.join(', ')}`,
  })
  tipo!: string;

  @IsIn(CATEGORIA_LANCAMENTO_VALUES, {
    message: `categoria deve ser um de: ${CATEGORIA_LANCAMENTO_VALUES.join(', ')}`,
  })
  categoria!: string;

  @IsNumber()
  @IsPositive({ message: 'O valor deve ser maior que zero.' })
  valor!: number;

  @IsDateString()
  vencimento!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  descricao?: string;
}
