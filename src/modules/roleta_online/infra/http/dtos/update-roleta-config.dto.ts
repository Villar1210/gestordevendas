// src/modules/roleta_online/infra/http/dtos/update-roleta-config.dto.ts
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateRoletaConfigDto {
  @IsOptional()
  @IsIn(['round_robin', 'menor_fila'], {
    message: 'Algoritmo invalido. Use um destes: round_robin, menor_fila.',
  })
  algoritmo?: string;

  @IsOptional()
  @IsIn(['automatico', 'semi_automatico'], {
    message: 'Modo invalido. Use um destes: automatico, semi_automatico.',
  })
  modo?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  timeoutAceiteMinutos?: number;
}
