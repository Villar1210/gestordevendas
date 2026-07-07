// src/modules/vendas_kanban/infra/http/dtos/move-card.dto.ts
import { IsInt, IsString, Min } from 'class-validator';

export class MoveCardDto {
  @IsString()
  targetStageId!: string;

  @IsInt()
  @Min(0)
  targetIndex!: number;
}
