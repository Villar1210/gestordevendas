// src/modules/gestao_imobiliaria/infra/http/dtos/update-imovel-status.dto.ts
// PATCH /imoveis/:id/status - SO o status (forbidNonWhitelisted rejeita
// qualquer outro campo). Quem pode: ver AlterarStatusImovelUseCase (R1).
import { IsIn } from 'class-validator';
import { STATUS_VALUES } from './create-imovel.dto';

export class UpdateImovelStatusDto {
  @IsIn(STATUS_VALUES, { message: `status deve ser um de: ${STATUS_VALUES.join(', ')}` })
  status!: string;
}
