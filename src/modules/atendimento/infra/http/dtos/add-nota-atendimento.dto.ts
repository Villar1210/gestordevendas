// src/modules/atendimento/infra/http/dtos/add-nota-atendimento.dto.ts
import { IsString, MinLength } from 'class-validator';

export class AddNotaAtendimentoDto {
  @IsString()
  @MinLength(1, { message: 'Informe o texto da nota.' })
  texto!: string;
}
