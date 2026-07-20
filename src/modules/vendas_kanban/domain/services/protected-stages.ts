// src/modules/vendas_kanban/domain/services/protected-stages.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS. Nomes de Stage
// referenciados como string magica em outros modulos - renomear ou
// deletar quebraria essas features silenciosamente:
// "Fechamento" (roleta_online/distribute-lead.use-case.ts, algoritmo
// menor_fila exclui essa stage da contagem de fila) e "Repique"
// (vivi_sdr/process-incoming-message.use-case.ts, deposito de leads
// sem_perfil). Usado por RenameStageUseCase/DeleteStageUseCase para
// bloquear essas duas, deixando as demais colunas livres.
export const PROTECTED_STAGE_NAMES = ['Fechamento', 'Repique'];

// Nomes individuais exportados para quem precisa referenciar uma stage
// especifica (ex: MoveCardUseCase exigindo motivoRepique so ao mover PARA
// Repique; MoverLeadsInativosParaRepiqueUseCase excluindo Fechamento/Repique
// da varredura de inatividade) em vez de comparar contra o array inteiro.
export const FECHAMENTO_STAGE_NAME = 'Fechamento';
export const REPIQUE_STAGE_NAME = 'Repique';

export function isProtectedStageName(name: string): boolean {
  return PROTECTED_STAGE_NAMES.includes(name);
}
