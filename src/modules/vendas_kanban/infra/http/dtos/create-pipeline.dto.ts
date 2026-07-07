// src/modules/vendas_kanban/infra/http/dtos/create-pipeline.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreatePipelineDto {
  @IsString()
  @MinLength(2, { message: 'Informe um nome para o pipeline.' })
  name!: string;
}
