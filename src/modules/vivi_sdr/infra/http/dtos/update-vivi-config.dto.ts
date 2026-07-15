// src/modules/vivi_sdr/infra/http/dtos/update-vivi-config.dto.ts
import { IsNumber, IsPositive } from 'class-validator';

export class UpdateViviConfigDto {
  @IsNumber()
  @IsPositive()
  precoMinimo!: number;

  @IsNumber()
  @IsPositive()
  limiteSemPerfil!: number;

  @IsNumber()
  @IsPositive()
  limiteHis1!: number;

  @IsNumber()
  @IsPositive()
  limiteHis2!: number;

  @IsNumber()
  @IsPositive()
  limiteHmp!: number;
}
