import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class AgendarVisitaViviDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^55\d{10,11}$/, {
    message: 'phoneNumber deve estar no formato 5511999990000',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataVisita deve estar no formato YYYY-MM-DD',
  })
  dataVisita!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horario deve estar no formato HH:mm',
  })
  horario!: string;

  @IsString()
  @IsOptional()
  empreendimentoId?: string;

  @IsString()
  @IsOptional()
  nomeCliente?: string;

  @IsString()
  @IsOptional()
  resumo?: string;

  @IsString()
  @IsOptional()
  existingCardId?: string;
}
