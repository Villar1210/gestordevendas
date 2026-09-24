import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SimularCreditoDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Informe a renda familiar bruta.' })
  @Min(1700, { message: 'A renda familiar mínima para simular é R$ 1.700,00.' })
  renda!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Informe a idade do comprador mais velho.' })
  @Min(21, { message: 'A idade mínima para simular é 21 anos.' })
  @Max(80, { message: 'A idade máxima para simular é 80 anos.' })
  idade!: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Valor inválido para dependente.' })
  @IsOptional()
  temDependente?: boolean;
}
