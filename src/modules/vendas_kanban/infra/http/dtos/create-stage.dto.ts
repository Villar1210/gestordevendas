// src/modules/vendas_kanban/infra/http/dtos/create-stage.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateStageDto {
  @IsString()
  @MinLength(1, { message: 'Informe um nome para a coluna.' })
  name!: string;
}
