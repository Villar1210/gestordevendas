// src/modules/gestao_imobiliaria/infra/http/dtos/reorder-photos.dto.ts
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

// Usado tanto por PATCH /imoveis/:id/photos/reorder quanto por
// PATCH /empreendimentos/:id/photos/reorder - photoIds e a lista de ids na
// ORDEM FINAL desejada (precisa corresponder exatamente ao conjunto de
// fotos existentes, ver ReorderImovelPhotosUseCase/ReorderEmpreendimentoPhotosUseCase).
export class ReorderPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoIds!: string[];
}
