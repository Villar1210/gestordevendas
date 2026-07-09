// src/modules/rh/infra/http/dtos/create-corretor.dto.ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCorretorDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome do corretor.' })
  name!: string;

  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password?: string;
}
