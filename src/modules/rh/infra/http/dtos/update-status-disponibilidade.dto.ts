// src/modules/rh/infra/http/dtos/update-status-disponibilidade.dto.ts
import { IsIn } from 'class-validator';

export class UpdateStatusDisponibilidadeDto {
  @IsIn(['online', 'ausente', 'offline'], {
    message: 'Status invalido. Use um destes: online, ausente, offline.',
  })
  status!: string;
}
