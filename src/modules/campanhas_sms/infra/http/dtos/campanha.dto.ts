// src/modules/campanhas_sms/infra/http/dtos/campanha.dto.ts
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { STATUS_CONTATO } from '../../../domain/services/campanha-regras';

export class CriarCampanhaDto {
  @IsString({ message: 'nome deve ser texto.' })
  @MaxLength(120, { message: 'Nome com no máximo 120 caracteres.' })
  nome!: string;

  @IsString({ message: 'mensagem deve ser texto.' })
  @MaxLength(600, { message: 'Mensagem com no máximo 600 caracteres.' })
  mensagem!: string;

  @IsString({ message: 'linkDestino deve ser texto.' })
  @MaxLength(500, { message: 'Link com no máximo 500 caracteres.' })
  linkDestino!: string;

  @IsOptional()
  @IsInt({ message: 'maxSegmentos deve ser inteiro.' })
  @Min(1)
  @Max(3)
  maxSegmentos?: number;

  @IsOptional()
  @IsInt({ message: 'taxaPorMinuto deve ser inteiro.' })
  @Min(6)
  @Max(120)
  taxaPorMinuto?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  janelaInicio?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  janelaFim?: number;
}

export class AtualizarCampanhaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Nome com no máximo 120 caracteres.' })
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600, { message: 'Mensagem com no máximo 600 caracteres.' })
  mensagem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Link com no máximo 500 caracteres.' })
  linkDestino?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  maxSegmentos?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(120)
  taxaPorMinuto?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  janelaInicio?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  janelaFim?: number;
}

export class TelefoneDto {
  @IsString({ message: 'Informe o telefone.' })
  @MaxLength(30)
  telefone!: string;
}

export class EnviarTesteDto extends TelefoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  primeiroNome?: string;
}

export class ListarContatosQueryDto {
  @IsOptional()
  @IsIn(STATUS_CONTATO as unknown as string[], { message: 'status inválido.' })
  status?: (typeof STATUS_CONTATO)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  busca?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pagina?: number;
}

export class ExportarQueryDto {
  @IsOptional()
  @IsIn(['todos', 'clicou', 'respondeu', 'optout', 'falhou'], { message: 'filtro inválido.' })
  filtro?: 'todos' | 'clicou' | 'respondeu' | 'optout' | 'falhou';
}

export class ImportarBodyDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  substituir?: boolean;
}
