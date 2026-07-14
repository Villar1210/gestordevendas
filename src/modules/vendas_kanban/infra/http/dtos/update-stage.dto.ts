// src/modules/vendas_kanban/infra/http/dtos/update-stage.dto.ts
import { IsString, MinLength } from 'class-validator';

export class UpdateStageDto {
  @IsString()
  @MinLength(1, { message: 'Informe um nome para a coluna.' })
  name!: string;
}
