// src/modules/auth/infra/http/dtos/register.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da empresa.' })
  companyName!: string;

  @IsString()
  @MinLength(2, { message: 'Informe o nome do responsavel.' })
  ownerName!: string;

  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password!: string;
}
