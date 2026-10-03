// src/modules/roleta_online/infra/http/dtos/salvar-roleta.dto.ts
// Fatia 2 (Sorteio da vez). Regras de negocio completas em SalvarRoletaUseCase.
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SalvarRoletaDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsIn(['stand', 'produto'], { message: 'Tipo invalido. Use stand ou produto.' })
  tipo!: string;

  @IsOptional()
  @IsUUID()
  standId?: string | null;

  @IsOptional()
  @IsBoolean()
  padrao?: boolean;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsIn(['automatico', 'botao'], { message: 'Modo invalido. Use automatico ou botao.' })
  modoSorteio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true, message: 'Horario invalido. Use HH:MM.' })
  horariosSorteio?: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(45)
  minutosSorteioSeguranca?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  empreendimentoIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  corretorIds?: string[];
}
