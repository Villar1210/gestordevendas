import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProprietarioDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do proprietario.' })
  nome!: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsString()
  @MinLength(1, { message: 'Informe o telefone do proprietario.' })
  telefone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string;

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
  banco?: string;

  @IsOptional()
  @IsString()
  agencia?: string;

  @IsOptional()
  @IsString()
  conta?: string;

  @IsOptional()
  @IsString()
  pix?: string;
}
