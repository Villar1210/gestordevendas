// src/modules/configuracoes/infra/http/dtos/update-tenant-config.dto.ts
import { IsString, IsOptional, IsInt, IsIn, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { AcaoLimiteVivi } from '../../../domain/repositories/tenant-config-repository.interface';

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

  // Site imobiliario publico. String vazia = remover. Validacao de formato
  // no use case (depois de normalizar maiusculas, "www." e protocolo).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^$|^[a-zA-Z0-9-]+$/, { message: 'O endereço do site só pode ter letras, números e hífen.' })
  siteSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  siteDominio?: string;

  // Controle de volume/custo da VIVI (Fatia B) - ver
  // UpdateTenantConfigUseCase para a validacao de negocio (limite > 0,
  // PAUSAR ainda rejeitado por nao ter logica associada).
  @IsOptional()
  @IsInt()
  @Min(1)
  limiteMensagensViviDia?: number;

  @IsOptional()
  @IsIn(['ALERTAR', 'PAUSAR'])
  acaoLimiteVivi?: AcaoLimiteVivi;
}
