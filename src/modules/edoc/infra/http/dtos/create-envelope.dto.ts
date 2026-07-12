// src/modules/edoc/infra/http/dtos/create-envelope.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

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

  // Assunto/mensagem customizaveis do e-mail de convite (Fatia 4) -
  // opcionais, o SendEnvelopeUseCase aplica o template padrao se vazios.
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailMessage?: string;
}
