// src/modules/atendimento/infra/http/dtos/create-fila.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateFilaDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome da fila.' })
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
