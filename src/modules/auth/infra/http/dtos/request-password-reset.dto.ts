// src/modules/auth/infra/http/dtos/request-password-reset.dto.ts
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email!: string;
}
