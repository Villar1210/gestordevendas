// src/modules/atendimento/infra/http/dtos/enviar-mensagem-atendimento.dto.ts
import { IsString, MinLength } from 'class-validator';

export class EnviarMensagemAtendimentoDto {
  @IsString()
  @MinLength(1, { message: 'Informe o texto da mensagem.' })
  body!: string;
}
