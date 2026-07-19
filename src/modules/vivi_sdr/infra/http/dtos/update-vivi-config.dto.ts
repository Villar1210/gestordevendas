import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

// Campos de detalhe por faixa (subsidio/juros/teto de financiamento/
// exemplo de parcela) sao todos opcionais - nem toda faixa tem subsidio
// (Faixa 3/4 normalmente nao tem) e exemploParcela e deliberadamente
// livre para o Administrador preencher ou nao (ver PROGRESS.md, secao
// "VIVI - Atualizacao 2026").
export class UpdateViviConfigDto {
  @IsNumber()
  @IsPositive()
  precoMinimo!: number;

  @IsNumber()
  @IsPositive()
  limiteSemPerfil!: number;

  @IsNumber()
  @IsPositive()
  limiteFaixa1!: number;

  @IsNumber()
  @IsPositive()
  limiteFaixa2!: number;

  @IsNumber()
  @IsPositive()
  limiteFaixa3!: number;

  @IsNumber()
  @IsPositive()
  limiteFaixa4!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa1SubsidioMax?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa1JurosMin?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa1JurosMax?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  faixa1TetoFinanciamento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  faixa1ExemploParcela?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa2SubsidioMax?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa2JurosMin?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa2JurosMax?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  faixa2TetoFinanciamento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  faixa2ExemploParcela?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa3SubsidioMax?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa3JurosMin?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa3JurosMax?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  faixa3TetoFinanciamento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  faixa3ExemploParcela?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa4SubsidioMax?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa4JurosMin?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faixa4JurosMax?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  faixa4TetoFinanciamento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  faixa4ExemploParcela?: string | null;
}
