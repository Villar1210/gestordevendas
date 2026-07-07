// src/modules/vendas_kanban/infra/http/dtos/move-stage.dto.ts
import { IsInt, Min } from 'class-validator';

export class MoveStageDto {
  @IsInt()
  @Min(0)
  targetIndex!: number;
}
