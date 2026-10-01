// src/modules/rh/infra/http/dtos/update-contrato-parceria-config.dto.ts
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContratoParceriaConfigDto {
  @IsBoolean()
  assinaturaEmpresaAtiva!: boolean;

  @IsOptional() @IsString() @MaxLength(150)
  representanteNome?: string | null;

  @IsOptional() @IsString() @MaxLength(150)
  representanteEmail?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  representanteCargo?: string | null;

  @IsIn([0, 1, 2])
  quantidadeTestemunhas!: number;

  @IsOptional() @IsString() @MaxLength(150)
  testemunha1Nome?: string | null;

  @IsOptional() @IsString() @MaxLength(150)
  testemunha1Email?: string | null;

  @IsOptional() @IsString() @MaxLength(150)
  testemunha2Nome?: string | null;

  @IsOptional() @IsString() @MaxLength(150)
  testemunha2Email?: string | null;

  @IsBoolean()
  bloquearAcessoAteAssinar!: boolean;

  @IsBoolean()
  lembretesAtivos!: boolean;

  @IsOptional() @IsString() @MaxLength(30)
  lembreteDias?: string;
}
