// src/modules/gestao_imobiliaria/infra/http/dtos/construtora.dto.ts
// Cadastro de Construtoras (Fatia A). Limites iguais as colunas do banco.
// null nos campos opcionais = limpar (PATCH). Regras de conteudo (nome
// normalizado unico, site so https) ficam nos use cases.
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CONSTRUTORA_DIFERENCIAIS_MAX,
  CONSTRUTORA_NOME_MAX,
  CONSTRUTORA_SITE_MAX,
  CONSTRUTORA_SOBRE_MAX,
} from '../../../domain/services/construtora';

export class CriarConstrutoraDto {
  @IsString({ message: 'Informe o nome da construtora.' })
  @MaxLength(CONSTRUTORA_NOME_MAX, { message: `O nome deve ter no máximo ${CONSTRUTORA_NOME_MAX} caracteres.` })
  nome!: string;

  @IsOptional()
  @IsString({ message: 'Site inválido.' })
  @MaxLength(CONSTRUTORA_SITE_MAX, { message: `O site deve ter no máximo ${CONSTRUTORA_SITE_MAX} caracteres.` })
  site?: string | null;

  @IsOptional()
  @IsString({ message: 'Texto "Sobre" inválido.' })
  @MaxLength(CONSTRUTORA_SOBRE_MAX, { message: `O texto "Sobre" deve ter no máximo ${CONSTRUTORA_SOBRE_MAX} caracteres.` })
  sobre?: string | null;

  @IsOptional()
  @IsString({ message: 'Texto de diferenciais inválido.' })
  @MaxLength(CONSTRUTORA_DIFERENCIAIS_MAX, {
    message: `Os diferenciais devem ter no máximo ${CONSTRUTORA_DIFERENCIAIS_MAX} caracteres.`,
  })
  diferenciais?: string | null;
}

export class AtualizarConstrutoraDto {
  @IsOptional()
  @IsString({ message: 'Informe o nome da construtora.' })
  @MaxLength(CONSTRUTORA_NOME_MAX, { message: `O nome deve ter no máximo ${CONSTRUTORA_NOME_MAX} caracteres.` })
  nome?: string;

  @IsOptional()
  @IsString({ message: 'Site inválido.' })
  @MaxLength(CONSTRUTORA_SITE_MAX, { message: `O site deve ter no máximo ${CONSTRUTORA_SITE_MAX} caracteres.` })
  site?: string | null;

  @IsOptional()
  @IsString({ message: 'Texto "Sobre" inválido.' })
  @MaxLength(CONSTRUTORA_SOBRE_MAX, { message: `O texto "Sobre" deve ter no máximo ${CONSTRUTORA_SOBRE_MAX} caracteres.` })
  sobre?: string | null;

  @IsOptional()
  @IsString({ message: 'Texto de diferenciais inválido.' })
  @MaxLength(CONSTRUTORA_DIFERENCIAIS_MAX, {
    message: `Os diferenciais devem ter no máximo ${CONSTRUTORA_DIFERENCIAIS_MAX} caracteres.`,
  })
  diferenciais?: string | null;
}
