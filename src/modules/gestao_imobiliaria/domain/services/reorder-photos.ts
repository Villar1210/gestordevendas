// src/modules/gestao_imobiliaria/domain/services/reorder-photos.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS - reaproveitada tanto
// pelo reorder de ImovelPhoto quanto de EmpreendimentoPhoto (Fatia 5).
// Recebe a lista de ids na ordem final desejada e devolve o "order"
// sequencial de cada um - os use cases de cada agregado validam
// separadamente que os ids pertencem ao tenant/pai certo antes de chamar
// isto, mantendo os dois agregados desacoplados entre si.

export interface PhotoOrderPatch {
  id: string;
  order: number;
}

export function computePhotoOrders(photoIdsInFinalOrder: string[]): PhotoOrderPatch[] {
  return photoIdsInFinalOrder.map((id, index) => ({ id, order: index }));
}
