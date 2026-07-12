// src/modules/atendimento/infra/http/dtos/transfer-atendimento.dto.ts
import { IsOptional, IsUUID } from 'class-validator';

export class TransferAtendimentoDto {
  @IsOptional()
  @IsUUID()
  filaId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
