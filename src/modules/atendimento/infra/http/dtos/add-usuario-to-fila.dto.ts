// src/modules/atendimento/infra/http/dtos/add-usuario-to-fila.dto.ts
import { IsUUID } from 'class-validator';

export class AddUsuarioToFilaDto {
  @IsUUID()
  userId!: string;
}
