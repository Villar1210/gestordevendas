// src/modules/auth/infra/http/dtos/verify-two-factor-code.dto.ts
import { IsString, Matches } from 'class-validator';

export class VerifyTwoFactorCodeDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'O codigo deve conter exatamente 6 digitos.' })
  code!: string;
}
