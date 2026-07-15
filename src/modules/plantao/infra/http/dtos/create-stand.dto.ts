// src/modules/plantao/infra/http/dtos/create-stand.dto.ts
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateStandDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do stand.' })
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string;
}
