// src/modules/whatsappmarketing/infra/http/dtos/create-whatsapp-session.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWhatsAppSessionDto {
  @IsString()
  @MinLength(2, { message: 'Informe um nome/rotulo para a sessao.' })
  label!: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
