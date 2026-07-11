// src/modules/edoc/infra/http/dtos/create-envelope.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateEnvelopeDto {
  @IsString()
  @MinLength(1, { message: 'Informe o titulo do envelope.' })
  title!: string;

  // multipart/form-data nao suporta array nativo junto com arquivo - o
  // frontend envia um JSON stringificado ([{ name, email, role? }, ...] -
  // role: "destinatario"/"remetente"/"testemunha", default "destinatario"
  // se omitido - Fatia 3), parseado e validado manualmente no controller.
  @IsString()
  recipients!: string;

  // JSON stringificado ([{ recipientIndex, tipo?, pageNumber, xPercent,
  // yPercent, widthPercent?, heightPercent? }, ...] - tipo:
  // "assinatura"/"rubrica", default "assinatura" se omitido - Fatia 3) -
  // mesma razao do campo acima.
  @IsString()
  fields!: string;
}
