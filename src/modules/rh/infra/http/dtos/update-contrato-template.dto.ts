// src/modules/rh/infra/http/dtos/update-contrato-template.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateContratoTemplateDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do template.' })
  @MaxLength(150)
  nome!: string;

  @IsString()
  @MinLength(1, { message: 'O corpo do contrato nao pode ficar vazio.' })
  corpo!: string;
}
