// src/modules/rh/infra/http/dtos/update-user-cargo.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class UpdateUserCargoDto {
  @IsOptional()
  @IsString()
  cargoHierarquico?: string | null;

  @IsOptional()
  @IsString()
  superiorId?: string | null;
}
