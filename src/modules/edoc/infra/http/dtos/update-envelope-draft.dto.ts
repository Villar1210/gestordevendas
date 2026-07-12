// src/modules/edoc/infra/http/dtos/update-envelope-draft.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateEnvelopeDraftDto {
  @IsString()
  @MinLength(1, { message: 'Informe o titulo do envelope.' })
  title!: string;

  // Mesmo formato JSON stringificado de CreateEnvelopeDto - ver comentarios la.
  @IsString()
  recipients!: string;

  @IsString()
  fields!: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailMessage?: string;

  // Arquivo (file) e opcional aqui - so enviado no multipart quando o
  // usuario troca o documento; nao existe como campo de texto neste DTO,
  // vem via @UploadedFile() no controller.
}
