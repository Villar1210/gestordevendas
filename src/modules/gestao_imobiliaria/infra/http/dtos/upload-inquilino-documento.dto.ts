import { IsIn } from 'class-validator';

export const TIPO_DOCUMENTO_VALUES = [
  'rg_cpf',
  'comprovante_renda',
  'comprovante_residencia',
  'outro',
];

export class UploadInquilinoDocumentoDto {
  @IsIn(TIPO_DOCUMENTO_VALUES, {
    message: `tipo deve ser um de: ${TIPO_DOCUMENTO_VALUES.join(', ')}`,
  })
  tipo!: string;
}
