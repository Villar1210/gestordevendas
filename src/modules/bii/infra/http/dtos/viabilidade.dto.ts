// src/modules/bii/infra/http/dtos/viabilidade.dto.ts - corpo de POST /bii/viabilidade.
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;
const NUM = { allowNaN: false, allowInfinity: false };

export class TipologiaViabilidadeDto {
  @IsString({ message: 'Descreva cada tipologia.' })
  @MinLength(1, { message: 'Descreva cada tipologia.' })
  @MaxLength(100, { message: 'A descrição pode ter no máximo 100 caracteres.' })
  @Matches(SEM_CONTROLE, { message: 'A descrição tem caracteres inválidos.' })
  descricao!: string;

  @IsNumber(NUM, { message: 'A área privativa deve ser um número.' })
  @Min(10, { message: 'A área privativa mínima é 10 m².' })
  @Max(1000, { message: 'A área privativa máxima é 1.000 m².' })
  areaPrivativa!: number;

  @IsNumber(NUM, { message: 'O preço deve ser um número.' })
  @Min(10_000, { message: 'O preço mínimo é R$ 10 mil.' })
  @Max(100_000_000, { message: 'O preço máximo é R$ 100 milhões.' })
  preco!: number;
}

export class PremissasDto {
  @IsOptional()
  @IsNumber(NUM, { message: 'A entrada deve ser um número.' })
  @Min(0, { message: 'A entrada mínima é 0%.' })
  @Max(90, { message: 'A entrada máxima é 90%.' })
  entradaPercentual?: number;

  @IsOptional()
  @IsInt({ message: 'O prazo deve ser um número inteiro de meses.' })
  @Min(60, { message: 'O prazo mínimo é 60 meses.' })
  @Max(420, { message: 'O prazo máximo é 420 meses (35 anos).' })
  prazoMeses?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'O comprometimento deve ser um número.' })
  @Min(10, { message: 'O comprometimento mínimo é 10%.' })
  @Max(50, { message: 'O comprometimento máximo é 50%.' })
  comprometimentoPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'Os juros devem ser um número.' })
  @Min(0, { message: 'Os juros não podem ser negativos.' })
  @Max(30, { message: 'Os juros podem ser no máximo 30% ao ano.' })
  jurosAnual?: number | null;
}

export class CalcularViabilidadeDto {
  @IsArray({ message: 'Informe as tipologias como lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma tipologia.' })
  @ArrayMaxSize(20, { message: 'Informe no máximo 20 tipologias.' })
  @ValidateNested({ each: true })
  @Type(() => TipologiaViabilidadeDto)
  tipologias!: TipologiaViabilidadeDto[];

  @IsOptional()
  @IsObject({ message: 'premissas deve ser um objeto.' })
  @ValidateNested()
  @Type(() => PremissasDto)
  premissas?: PremissasDto;
}

// ---------------------------------------------------------------------------
// Fatia 7 - Viabilidade financeira (POST /bii/viabilidade-financeira e o bloco
// "financeiro" do estudo). Contrato: docs/bii/fatia7/CONTRATO_VIABILIDADE_FINANCEIRA.md

export class TipologiaFinanceiraDto extends TipologiaViabilidadeDto {
  @IsInt({ message: 'A quantidade de unidades deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade mínima é 1 unidade.' })
  @Max(5000, { message: 'A quantidade máxima é 5.000 unidades por tipologia.' })
  quantidade!: number;
}

// Estudo de terreno: quantidade opcional (o financeiro so e calculado com ela)
export class TipologiaEstudoDto extends TipologiaViabilidadeDto {
  @IsOptional()
  @IsInt({ message: 'A quantidade de unidades deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade mínima é 1 unidade.' })
  @Max(5000, { message: 'A quantidade máxima é 5.000 unidades por tipologia.' })
  quantidade?: number;
}

export class TerrenoFinanceiroDto {
  @IsOptional()
  @IsNumber(NUM, { message: 'O valor do terreno deve ser um número.' })
  @Min(0, { message: 'O valor do terreno não pode ser negativo.' })
  @Max(2_000_000_000, { message: 'O valor do terreno pode ser no máximo R$ 2 bilhões.' })
  valorCompra?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'O ITBI deve ser um número.' })
  @Min(0, { message: 'O ITBI mínimo é 0%.' })
  @Max(10, { message: 'O ITBI máximo é 10%.' })
  itbiPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'Escritura e registro devem ser um número.' })
  @Min(0, { message: 'Escritura e registro: mínimo 0%.' })
  @Max(10, { message: 'Escritura e registro: máximo 10%.' })
  escrituraRegistroPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'A permuta deve ser um número.' })
  @Min(0, { message: 'A permuta mínima é 0%.' })
  @Max(60, { message: 'A permuta máxima é 60% do VGV.' })
  permutaPercentual?: number;
}

export class ObraFinanceiraDto {
  @IsNumber(NUM, { message: 'Informe o custo de obra em R$/m² de área construída.' })
  @Min(500, { message: 'O custo de obra mínimo é R$ 500/m².' })
  @Max(20_000, { message: 'O custo de obra máximo é R$ 20.000/m².' })
  custoM2!: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber(NUM, { message: 'A área construída deve ser um número.' })
  @Min(1, { message: 'A área construída mínima é 1 m².' })
  @Max(2_000_000, { message: 'A área construída máxima é 2.000.000 m².' })
  areaConstruida?: number | null;

  @IsOptional()
  @IsNumber(NUM, { message: 'O fator de área construída deve ser um número.' })
  @Min(1, { message: 'O fator de área construída mínimo é 1,0.' })
  @Max(3, { message: 'O fator de área construída máximo é 3,0.' })
  fatorAreaConstruida?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'Os custos indiretos devem ser um número.' })
  @Min(0, { message: 'Custos indiretos: mínimo 0%.' })
  @Max(50, { message: 'Custos indiretos: máximo 50%.' })
  indiretosPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'A contingência deve ser um número.' })
  @Min(0, { message: 'Contingência: mínimo 0%.' })
  @Max(30, { message: 'Contingência: máximo 30%.' })
  contingenciaPercentual?: number;
}

export class ComercialFinanceiroDto {
  @IsOptional()
  @IsIn(['ret4', 'ret1', 'outro'], { message: 'Escolha o regime de imposto: RET 4%, RET 1% ou outro percentual.' })
  impostoRegime?: 'ret4' | 'ret1' | 'outro';

  @IsOptional()
  @IsNumber(NUM, { message: 'O imposto deve ser um número.' })
  @Min(0, { message: 'O imposto mínimo é 0%.' })
  @Max(30, { message: 'O imposto máximo é 30%.' })
  impostoPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'A comissão deve ser um número.' })
  @Min(0, { message: 'A comissão mínima é 0%.' })
  @Max(15, { message: 'A comissão máxima é 15%.' })
  comissaoPercentual?: number;

  @IsOptional()
  @IsNumber(NUM, { message: 'O marketing deve ser um número.' })
  @Min(0, { message: 'O marketing mínimo é 0%.' })
  @Max(15, { message: 'O marketing máximo é 15%.' })
  marketingPercentual?: number;
}

export class PremissasFinanceirasDto {
  @IsOptional()
  @IsObject({ message: 'terreno deve ser um objeto.' })
  @ValidateNested()
  @Type(() => TerrenoFinanceiroDto)
  terreno?: TerrenoFinanceiroDto;

  @IsObject({ message: 'Informe os dados da obra.' })
  @ValidateNested()
  @Type(() => ObraFinanceiraDto)
  obra!: ObraFinanceiraDto;

  @IsOptional()
  @IsObject({ message: 'comercial deve ser um objeto.' })
  @ValidateNested()
  @Type(() => ComercialFinanceiroDto)
  comercial?: ComercialFinanceiroDto;

  @IsOptional()
  @IsNumber(NUM, { message: 'A margem desejada deve ser um número.' })
  @Min(0, { message: 'A margem desejada mínima é 0%.' })
  @Max(60, { message: 'A margem desejada máxima é 60%.' })
  margemAlvoPercentual?: number;
}

export class CalcularViabilidadeFinanceiraDto {
  @IsArray({ message: 'Informe as tipologias como lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma tipologia.' })
  @ArrayMaxSize(20, { message: 'Informe no máximo 20 tipologias.' })
  @ValidateNested({ each: true })
  @Type(() => TipologiaFinanceiraDto)
  tipologias!: TipologiaFinanceiraDto[];

  @IsObject({ message: 'Informe as premissas financeiras.' })
  @ValidateNested()
  @Type(() => PremissasFinanceirasDto)
  premissas!: PremissasFinanceirasDto;
}

// DTO -> entrada do caso de uso (so campos conhecidos; undefined = padrao)
export function premissasFinanceirasDoDto(d: PremissasFinanceirasDto) {
  return {
    terreno: d.terreno
      ? {
          valorCompra: d.terreno.valorCompra,
          itbiPercentual: d.terreno.itbiPercentual,
          escrituraRegistroPercentual: d.terreno.escrituraRegistroPercentual,
          permutaPercentual: d.terreno.permutaPercentual,
        }
      : undefined,
    obra: {
      custoM2: d.obra.custoM2,
      areaConstruida: d.obra.areaConstruida ?? null,
      fatorAreaConstruida: d.obra.fatorAreaConstruida,
      indiretosPercentual: d.obra.indiretosPercentual,
      contingenciaPercentual: d.obra.contingenciaPercentual,
    },
    comercial: d.comercial
      ? {
          impostoRegime: d.comercial.impostoRegime,
          impostoPercentual: d.comercial.impostoPercentual,
          comissaoPercentual: d.comercial.comissaoPercentual,
          marketingPercentual: d.comercial.marketingPercentual,
        }
      : undefined,
    margemAlvoPercentual: d.margemAlvoPercentual,
  };
}
