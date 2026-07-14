// src/modules/configuracoes/infra/http/dtos/update-tenant-config.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe a razao social.' })
  name?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cep?: string;
}
