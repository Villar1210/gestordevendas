import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInquilinoCompradorDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome.' })
  nome!: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsString()
  @MinLength(1, { message: 'Informe o telefone.' })
  telefone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string;
}
