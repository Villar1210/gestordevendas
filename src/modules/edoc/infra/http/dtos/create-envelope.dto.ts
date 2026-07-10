// src/modules/edoc/infra/http/dtos/create-envelope.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateEnvelopeDto {
  @IsString()
  @MinLength(1, { message: 'Informe o titulo do envelope.' })
  title!: string;

  // multipart/form-data nao suporta array nativo junto com arquivo - o
  // frontend envia um JSON stringificado ([{ name, email }, ...]),
  // parseado e validado manualmente no controller.
  @IsString()
  recipients!: string;

  // JSON stringificado ([{ recipientIndex, pageNumber, xPercent, yPercent,
  // widthPercent?, heightPercent? }, ...]) - mesma razao do campo acima.
  @IsString()
  fields!: string;
}
