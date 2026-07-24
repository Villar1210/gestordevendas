// src/modules/atendimento/domain/services/fila-categorias.ts
// Camada de DOMINIO: constantes puras, sem Prisma/Nest/infra. Compartilhadas
// entre GetOrCreateAtendimentoUseCase (seed automatico) e o modulo vivi_sdr
// (mapeia a categoria escolhida pela tool "transferir_para_fila" para o
// nome exato da Fila padrao correspondente).

// Fila dedicada para falha tecnica da IA (VIVI indisponivel apos esgotar as
// tentativas de retry da API da Anthropic - ver auditoria de producao,
// Critico #1). Separada das 3 filas de categoria abaixo DE PROPOSITO: uma
// falha tecnica ("nosso robo caiu") precisa de triagem diferente de uma
// duvida genuina do lead, e sempre marcada urgente=true (ver
// ProcessIncomingMessageUseCase.handleAiFailure) - misturar as duas na
// mesma fila dificultaria o Administrador diferenciar rapido as duas
// situacoes so pelo nome da fila.
export const FILA_ATENDIMENTO_PRIORITARIO_NOME = 'Atendimento Prioritario';

// Criadas automaticamente para um tenant que ainda nao tem nenhuma Fila, na
// primeira vez que um Atendimento e criado (ver GetOrCreateAtendimentoUseCase).
// "Atendimento Prioritario" entra no seed padrao (mesmo sem nenhuma falha
// tecnica ainda ter acontecido) para o Administrador poder vincular agentes
// a ela ANTES de precisar de verdade - sem isso, ela apareceria orfa (sem
// ninguem vinculado) bem na hora que mais importa.
// NOTA: "Repique" NAO e uma Fila (correcao aplicada na Fatia 5 do escopo
// completo da VIVI - leads sem perfil de renda agora viram Card direto na
// coluna "Repique" do Kanban, ver vendas_kanban/create-default-pipeline.use-case.ts
// e vivi_sdr/application/use-cases/process-incoming-message.use-case.ts).
export const DEFAULT_FILA_NAMES = [
  'Suporte',
  'Financeiro',
  'Duvidas Gerais',
  FILA_ATENDIMENTO_PRIORITARIO_NOME,
];

export const CATEGORIA_TO_FILA_NOME: Record<string, string> = {
  suporte: 'Suporte',
  financeiro: 'Financeiro',
  duvida_geral: 'Duvidas Gerais',
};
