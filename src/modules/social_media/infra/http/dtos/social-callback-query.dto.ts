// src/modules/social_media/infra/http/dtos/social-callback-query.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class SocialCallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  // Presentes quando o usuario cancela o consentimento na tela da Meta
  // (ex: error=access_denied) - a Meta sempre manda os 3 juntos nesse
  // caso. O ValidationPipe global usa forbidNonWhitelisted: true, entao
  // qualquer um desses 2 extras que nao for declarado aqui derrubaria a
  // requisicao inteira com 400 ANTES de chegar no controller.
  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_reason?: string;

  @IsOptional()
  @IsString()
  error_description?: string;
}
