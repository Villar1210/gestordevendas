// src/modules/vendas_kanban/infra/http/dtos/create-activity.dto.ts
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const ACTIVITY_TYPES = ['ligacao', 'reuniao', 'visita', 'tarefa', 'proposta'];

export class CreateActivityDto {
  @IsIn(ACTIVITY_TYPES, { message: `type deve ser um de: ${ACTIVITY_TYPES.join(', ')}` })
  type!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
