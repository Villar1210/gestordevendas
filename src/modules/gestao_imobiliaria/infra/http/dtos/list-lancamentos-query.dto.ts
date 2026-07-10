import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { TIPO_LANCAMENTO_VALUES } from './create-lancamento.dto';

export const STATUS_LANCAMENTO_VALUES = ['pendente', 'pago', 'atrasado'];

export class ListLancamentosQueryDto {
  @IsOptional()
  @IsIn(TIPO_LANCAMENTO_VALUES, {
    message: `tipo deve ser um de: ${TIPO_LANCAMENTO_VALUES.join(', ')}`,
  })
  tipo?: string;

  @IsOptional()
  @IsIn(STATUS_LANCAMENTO_VALUES, {
    message: `status deve ser um de: ${STATUS_LANCAMENTO_VALUES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsString()
  contratoId?: string;

  @IsOptional()
  @IsDateString()
  vencimentoDe?: string;

  @IsOptional()
  @IsDateString()
  vencimentoAte?: string;
}
