import { IsIn, IsOptional, IsString } from 'class-validator';
import { FINALIDADE_VALUES, STATUS_VALUES } from './create-imovel.dto';

export class ListImoveisQueryDto {
  @IsOptional()
  @IsIn(FINALIDADE_VALUES, {
    message: `finalidade deve ser um de: ${FINALIDADE_VALUES.join(', ')}`,
  })
  finalidade?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES, { message: `status deve ser um de: ${STATUS_VALUES.join(', ')}` })
  status?: string;

  @IsOptional()
  @IsString()
  empreendimentoId?: string;

  @IsOptional()
  @IsString()
  busca?: string;
}
