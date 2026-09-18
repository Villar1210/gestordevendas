// src/modules/gestao_imobiliaria/infra/http/dtos/create-empreendimento.dto.ts
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Length, MinLength } from 'class-validator';

export const EMPREENDIMENTO_TIPOS = ['vertical', 'horizontal', 'comercial', 'misto'] as const;
export const EMPREENDIMENTO_STATUS = ['breve_lancamento', 'lancamento', 'em_obras', 'pronto'] as const;

export class CreateEmpreendimentoDto {
  @IsString()
  @MinLength(1, { message: 'Informe um nome para o empreendimento.' })
  name!: string;

  // Endereço
  @IsString()
  @MinLength(1, { message: 'Informe a rua.' })
  rua!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o numero.' })
  numero!: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @MinLength(1, { message: 'Informe o bairro.' })
  bairro!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a cidade.' })
  cidade!: string;

  @IsString()
  @Length(2, 2, { message: 'UF deve ter 2 letras.' })
  uf!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o CEP.' })
  cep!: string;

  // Caracterização
  @IsOptional()
  @IsString()
  @IsIn(EMPREENDIMENTO_TIPOS, { message: 'Tipo inválido. Use: vertical, horizontal, comercial ou misto.' })
  tipo?: string;

  @IsOptional()
  @IsString()
  construtora?: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPREENDIMENTO_STATUS, { message: 'Status inválido. Use: breve_lancamento, lancamento, em_obras ou pronto.' })
  statusObra?: string;

  // Preço
  @IsOptional()
  @IsNumber({}, { message: 'precoMinimo deve ser um número.' })
  @IsPositive({ message: 'precoMinimo deve ser positivo.' })
  precoMinimo?: number;

  @IsOptional()
  @IsNumber({}, { message: 'precoMaximo deve ser um número.' })
  @IsPositive({ message: 'precoMaximo deve ser positivo.' })
  precoMaximo?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
