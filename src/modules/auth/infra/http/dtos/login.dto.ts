// src/modules/auth/infra/http/dtos/login.dto.ts
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
