// src/modules/rh/infra/http/dtos/aprovar-cadastro.dto.ts
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { VALID_CARGOS_HIERARQUICOS } from '../../../domain/services/cargos-hierarquicos';

export class AprovarCadastroDto {
  @IsOptional()
  // 25/11/2026: usa a lista unica de cargos (antes faltavam gerente_regional e
  // diretor_regional - aprovar um Gerente Regional dava erro).
  @IsIn(VALID_CARGOS_HIERARQUICOS, {
    message: `Cargo hierarquico invalido. Use um destes: ${VALID_CARGOS_HIERARQUICOS.join(', ')}.`,
  })
  cargoHierarquico?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'superiorId deve ser um uuid valido.' })
  superiorId?: string;
}
