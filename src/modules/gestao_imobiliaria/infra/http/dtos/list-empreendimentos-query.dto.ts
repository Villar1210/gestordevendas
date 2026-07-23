// src/modules/gestao_imobiliaria/infra/http/dtos/list-empreendimentos-query.dto.ts
import { IsIn, IsOptional } from 'class-validator';

export class ListEmpreendimentosQueryDto {
  // "true"/"false" como string (query param). Ausente = sem filtro (todos
  // os empreendimentos do tenant, comportamento de sempre) - usado pelo
  // Catalogo e pelo Cadastro em Lote, que precisam gerenciar tambem os
  // pendentes de revisao. So o Espelho de Vendas passa publicado=true
  // (Fatia 4 - Espelho so mostra o que ja foi revisado/publicado).
  @IsOptional()
  @IsIn(['true', 'false'])
  publicado?: string;
}
