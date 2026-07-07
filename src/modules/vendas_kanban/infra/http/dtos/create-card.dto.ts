// src/modules/vendas_kanban/infra/http/dtos/create-card.dto.ts
import { IsIn, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

const ORIGEM_VALUES = ['manual', 'webhook', 'roleta_online'];
const TEMPERATURA_VALUES = ['quente', 'morno', 'frio'];

export class CreateCardDto {
  // Informe stageId (criacao dentro de uma coluna) OU pipelineId
  // (criacao pelo cabecalho - entra direto na primeira stage do pipeline).
  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  pipelineId?: string;

  @IsString()
  @MinLength(1, { message: 'Informe um titulo para o card.' })
  title!: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsIn(ORIGEM_VALUES, { message: `origem deve ser um de: ${ORIGEM_VALUES.join(', ')}` })
  origem?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(TEMPERATURA_VALUES, {
    message: `temperatura deve ser um de: ${TEMPERATURA_VALUES.join(', ')}`,
  })
  temperatura?: string;

  @IsOptional()
  @IsString()
  imovelId?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
