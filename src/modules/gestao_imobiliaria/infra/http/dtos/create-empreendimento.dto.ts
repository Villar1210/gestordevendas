import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class CreateEmpreendimentoDto {
  @IsString()
  @MinLength(1, { message: 'Informe um nome para o empreendimento.' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a rua.' })
  rua!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o numero.' })
  numero!: string;

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

  @IsOptional()
  @IsString()
  description?: string;
}
