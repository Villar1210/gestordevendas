// src/modules/roleta_online/infra/http/dtos/update-roleta-config.dto.ts
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

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
}
