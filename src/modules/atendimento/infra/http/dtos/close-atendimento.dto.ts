// src/modules/atendimento/infra/http/dtos/close-atendimento.dto.ts
import { IsIn, IsOptional } from 'class-validator';
import { MOTIVOS_FECHAMENTO } from '../../../domain/services/motivo-fechamento';

export class CloseAtendimentoDto {
  // Lista fechada (I8a da auditoria) - antes texto livre. "abandono" (deteccao
  // automatica por timeout) fica de fora de proposito, ver motivo-fechamento.ts.
  @IsOptional()
  @IsIn(MOTIVOS_FECHAMENTO)
  motivo?: string;
}
