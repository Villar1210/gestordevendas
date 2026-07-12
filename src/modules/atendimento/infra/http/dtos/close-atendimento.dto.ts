// src/modules/atendimento/infra/http/dtos/close-atendimento.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CloseAtendimentoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
