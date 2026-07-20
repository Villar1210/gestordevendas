// src/modules/vendas_kanban/infra/http/dtos/move-card.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MOTIVOS_REPIQUE } from '../../../domain/services/motivo-repique';

export class MoveCardDto {
  @IsString()
  targetStageId!: string;

  @IsInt()
  @Min(0)
  targetIndex!: number;

  // Obrigatorio so quando a stage de destino e "Repique" - validado dentro
  // do MoveCardUseCase (a obrigatoriedade depende da stage de destino, nao
  // da presenca do campo em si, entao nao da pra usar @IsNotEmpty aqui).
  @IsOptional()
  @IsIn(MOTIVOS_REPIQUE)
  motivoRepique?: string;
}
