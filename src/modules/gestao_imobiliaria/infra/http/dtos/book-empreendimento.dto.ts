// src/modules/gestao_imobiliaria/infra/http/dtos/book-empreendimento.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ConfirmarFichaTecnicaDto } from './confirmar-ficha-tecnica.dto';
import { CATEGORIAS_PAGINA_BOOK, BOOK_MAX_PAGINAS } from '../../../domain/services/book-empreendimento';
import { EMPREENDIMENTO_STATUS, EMPREENDIMENTO_TIPOS } from './create-empreendimento.dto';

export class AnalisarBookDto {
  @IsOptional()
  @IsUUID('4', { message: 'Empreendimento inválido.' })
  empreendimentoId?: string;
}

export class PaginaBookDto {
  @IsInt()
  @Min(1)
  @Max(BOOK_MAX_PAGINAS)
  numero!: number;

  @IsIn(CATEGORIAS_PAGINA_BOOK, { message: 'Categoria de página inválida.' })
  categoria!: string;
}

export class NovoEmpreendimentoBookDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome do empreendimento.' })
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(2, { message: 'Informe a rua.' })
  @MaxLength(200)
  rua!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o número (use "s/n" se não houver).' })
  @MaxLength(20)
  numero!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complemento?: string;

  @IsString()
  @MinLength(2, { message: 'Informe o bairro.' })
  @MaxLength(100)
  bairro!: string;

  @IsString()
  @MinLength(2, { message: 'Informe a cidade.' })
  @MaxLength(100)
  cidade!: string;

  @Matches(/^[A-Z]{2}$/, { message: 'UF deve ter 2 letras maiúsculas (ex: SP).' })
  uf!: string;

  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido (ex: 01234-567).' })
  cep!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  construtora?: string;

  @IsOptional()
  @IsIn(EMPREENDIMENTO_TIPOS)
  tipo?: string;

  @IsOptional()
  @IsIn(EMPREENDIMENTO_STATUS)
  statusObra?: string;
}

export class ConfirmarBookDto {
  @IsUUID('4', { message: 'Análise inválida. Envie o PDF novamente.' })
  bookId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Empreendimento inválido.' })
  empreendimentoId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NovoEmpreendimentoBookDto)
  novo?: NovoEmpreendimentoBookDto;

  @ValidateNested()
  @Type(() => ConfirmarFichaTecnicaDto)
  ficha!: ConfirmarFichaTecnicaDto;

  @IsArray()
  @ArrayMaxSize(BOOK_MAX_PAGINAS)
  @ValidateNested({ each: true })
  @Type(() => PaginaBookDto)
  paginas!: PaginaBookDto[];
}
