// src/modules/whatsappmarketing/infra/http/dtos/send-whatsapp-message.dto.ts
import { IsString, MinLength } from 'class-validator';

export class SendWhatsAppMessageDto {
  @IsString()
  @MinLength(8, { message: 'Informe um numero de destino valido.' })
  to!: string;

  @IsString()
  @MinLength(1, { message: 'A mensagem nao pode ser vazia.' })
  body!: string;
}
