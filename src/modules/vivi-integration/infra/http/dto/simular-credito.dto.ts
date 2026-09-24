import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SimularCreditoDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1700)
  renda!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(21)
  @Max(80)
  idade!: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  temDependente?: boolean;
}
