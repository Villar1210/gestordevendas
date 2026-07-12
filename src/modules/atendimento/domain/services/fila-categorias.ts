// src/modules/atendimento/domain/services/fila-categorias.ts
// Camada de DOMINIO: constantes puras, sem Prisma/Nest/infra. Compartilhadas
// entre GetOrCreateAtendimentoUseCase (seed automatico) e o modulo vivi_sdr
// (mapeia a categoria escolhida pela tool "transferir_para_fila" para o
// nome exato da Fila padrao correspondente).

// Criadas automaticamente para um tenant que ainda nao tem nenhuma Fila, na
// primeira vez que um Atendimento e criado (ver GetOrCreateAtendimentoUseCase).
export const DEFAULT_FILA_NAMES = ['Suporte', 'Financeiro', 'Duvidas Gerais'];

export const CATEGORIA_TO_FILA_NOME: Record<string, string> = {
  suporte: 'Suporte',
  financeiro: 'Financeiro',
  duvida_geral: 'Duvidas Gerais',
};
