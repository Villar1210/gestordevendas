// src/modules/bii/infra/http/dtos/estudo.dto.ts - corpos de /bii/estudos (Fatia 5).
// Tipologias e premissas: mesmas regras da Fatia 4 (reaproveita os DTOs).
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PremissasDto, PremissasFinanceirasDto, TipologiaEstudoDto } from './viabilidade.dto';

const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;
// conclusao aceita quebra de linha (\n, \r) e tab, nada mais de controle
const SEM_CONTROLE_LONGO = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

export class CriarEstudoDto {
  @IsUUID('4', { message: 'Escolha uma análise válida.' })
  analiseId!: string;

  @IsString({ message: 'Dê um nome ao estudo.' })
  @MinLength(3, { message: 'O nome do estudo deve ter ao menos 3 caracteres.' })
  @MaxLength(120, { message: 'O nome do estudo pode ter no máximo 120 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'O nome tem caracteres inválidos.' })
  nome!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'A conclusão deve ser um texto.' })
  @MaxLength(5000, { message: 'A conclusão pode ter no máximo 5.000 caracteres.' })
  @Matches(SEM_CONTROLE_LONGO, { message: 'A conclusão tem caracteres inválidos.' })
  conclusao?: string | null;

  @IsArray({ message: 'Informe as tipologias como lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma tipologia.' })
  @ArrayMaxSize(20, { message: 'Informe no máximo 20 tipologias.' })
  @ValidateNested({ each: true })
  @Type(() => TipologiaEstudoDto)
  tipologias!: TipologiaEstudoDto[];

  @IsOptional()
  @IsObject({ message: 'premissas deve ser um objeto.' })
  @ValidateNested()
  @Type(() => PremissasDto)
  premissas?: PremissasDto;

  // Fatia 7: viabilidade financeira opcional (exige quantidade em todas as tipologias)
  @IsOptional()
  @IsObject({ message: 'financeiro deve ser um objeto.' })
  @ValidateNested()
  @Type(() => PremissasFinanceirasDto)
  financeiro?: PremissasFinanceirasDto;
}

export class AtualizarEstudoDto {
  // null nao e "ausente": so pula a validacao quando o campo nao veio
  @ValidateIf((_o, v) => v !== undefined)
  @IsString({ message: 'Dê um nome ao estudo.' })
  @MinLength(3, { message: 'O nome do estudo deve ter ao menos 3 caracteres.' })
  @MaxLength(120, { message: 'O nome do estudo pode ter no máximo 120 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'O nome tem caracteres inválidos.' })
  nome?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'A conclusão deve ser um texto.' })
  @MaxLength(5000, { message: 'A conclusão pode ter no máximo 5.000 caracteres.' })
  @Matches(SEM_CONTROLE_LONGO, { message: 'A conclusão tem caracteres inválidos.' })
  conclusao?: string | null;
}
