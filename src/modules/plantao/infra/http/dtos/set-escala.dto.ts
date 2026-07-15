// src/modules/plantao/infra/http/dtos/set-escala.dto.ts
import { IsString, IsInt, Min, Max } from 'class-validator';

export class SetEscalaDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;
}
