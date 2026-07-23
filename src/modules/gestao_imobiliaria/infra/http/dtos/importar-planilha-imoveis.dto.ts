// src/modules/gestao_imobiliaria/infra/http/dtos/importar-planilha-imoveis.dto.ts
import { IsString, MinLength } from 'class-validator';

export class ImportarPlanilhaImoveisDto {
  // Valor exato da coluna PRODUTO a filtrar - a planilha pode conter
  // multiplos empreendimentos misturados na mesma exportacao (ver
  // enunciado da Fatia 3a).
  @IsString()
  @MinLength(1, { message: 'Informe o produto (coluna PRODUTO) a importar.' })
  produto!: string;
}
