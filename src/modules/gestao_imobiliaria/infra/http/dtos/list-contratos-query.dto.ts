import { IsIn, IsOptional, IsString } from 'class-validator';
import { TIPO_CONTRATO_VALUES } from './create-contrato.dto';

export const STATUS_CONTRATO_VALUES = ['ativo', 'encerrado', 'cancelado'];

export class ListContratosQueryDto {
  @IsOptional()
  @IsIn(TIPO_CONTRATO_VALUES, {
    message: `tipo deve ser um de: ${TIPO_CONTRATO_VALUES.join(', ')}`,
  })
  tipo?: string;

  @IsOptional()
  @IsIn(STATUS_CONTRATO_VALUES, {
    message: `status deve ser um de: ${STATUS_CONTRATO_VALUES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsString()
  imovelId?: string;

  @IsOptional()
  @IsString()
  proprietarioId?: string;
}
