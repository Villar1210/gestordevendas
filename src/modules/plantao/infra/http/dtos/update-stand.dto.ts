// src/modules/plantao/infra/http/dtos/update-stand.dto.ts
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class UpdateStandDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do stand.' })
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string;

  @IsBoolean()
  ativo!: boolean;
}
