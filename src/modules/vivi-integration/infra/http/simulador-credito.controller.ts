import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { SimularCreditoUseCase } from '../../application/use-cases/simular-credito.use-case';
import { Type, Transform } from 'class-transformer';
import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

class SimularCreditoInternalDto {
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

@Controller('simulador')
@UseGuards(JwtAuthGuard)
export class SimuladorCreditoController {
  constructor(private readonly simularCreditoUseCase: SimularCreditoUseCase) {}

  @Get('credito')
  async simularCredito(@Query() dto: SimularCreditoInternalDto) {
    return this.simularCreditoUseCase.execute({
      renda: Number(dto.renda),
      idade: Number(dto.idade),
      temDependente: dto.temDependente === true || (dto.temDependente as any) === 'true',
    });
  }
}
