// src/modules/rh/infra/http/dtos/update-email-template.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsString()
  @MinLength(1, { message: 'Informe o assunto do e-mail.' })
  @MaxLength(200)
  assunto!: string;

  @IsString()
  @MinLength(1, { message: 'O corpo do e-mail nao pode ficar vazio.' })
  corpo!: string;
}
