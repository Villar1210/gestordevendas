// src/modules/vivi_sdr/domain/services/vivi-conversation-guard.ts
// Camada de DOMINIO: funcao pura (sem Prisma/Nest/infra) que decide se a
// VIVI deve ignorar uma mensagem por ja existir uma conversa transferida -
// extraida de dentro de ProcessIncomingMessageUseCase (I10 da auditoria,
// refactor estrutural puro, sem mudanca de comportamento).
import { ViviConversationStatus } from '../repositories/vivi-conversation-repository.interface';

// Guarda 1: se a conversa mais recente neste numero/sessao ja foi
// transferida (qualificado_transferido, duvida_transferido ou
// encaminhado_fila), a VIVI nao deve reabrir o dialogo - o corretor ou
// agente esta cuidando do lead. Uma nova conversa so e permitida se o
// status anterior era "em_andamento" (conversa ainda ativa) ou "encerrada"
// (ciclo anterior concluido, lead pode voltar a interagir).
export function deveIgnorarPorConversaTransferida(status: ViviConversationStatus): boolean {
  return status !== 'em_andamento' && status !== 'encerrada';
}
