// src/modules/rh/infra/http/dtos/aprovar-cadastro.dto.ts
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AprovarCadastroDto {
  @IsOptional()
  @IsIn(['diretor', 'superintendente', 'gerente', 'coordenador', 'corretor'], {
    message:
      'Cargo hierarquico invalido. Use um destes: diretor, superintendente, gerente, coordenador, corretor.',
  })
  cargoHierarquico?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'superiorId deve ser um uuid valido.' })
  superiorId?: string;
}
