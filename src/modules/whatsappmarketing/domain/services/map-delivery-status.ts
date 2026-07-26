// src/modules/whatsappmarketing/domain/services/map-delivery-status.ts
// Camada de DOMINIO: funcao pura, sem Prisma/Baileys/infra.
//
// Traduz o status numerico do evento 'messages.update' do Baileys
// (proto.WebMessageInfo.Status, node_modules/baileys/WAProto/index.d.ts)
// para o valor textual gravado em WhatsAppMessage.statusEntrega - ver
// comentario no schema.prisma. Copiado aqui como constantes numericas (nao
// importa o enum de "baileys") pelo mesmo motivo de
// select-recoverable-history-messages.ts: dominio nao pode depender de
// biblioteca externa (ver CLAUDE.md "Mantenha a separacao de camadas").
export type StatusEntrega = 'pending' | 'server_ack' | 'delivery_ack' | 'read' | 'failed';

const BAILEYS_ACK_STATUS = {
  ERROR: 0,
  PENDING: 1,
  SERVER_ACK: 2,
  DELIVERY_ACK: 3,
  READ: 4,
  PLAYED: 5,
} as const;

// READ e PLAYED (audio ouvido) colapsam no mesmo "read" - a distincao entre
// "leu" e "ouviu o audio" nao importa pra confirmar entrega, so pra UI de
// chat completa, que esta fora do escopo desta fatia (so captura/registro,
// sem retry/correcao automatica - ver CLAUDE.md).
export function mapBaileysAckStatusToStatusEntrega(status: number): StatusEntrega | null {
  switch (status) {
    case BAILEYS_ACK_STATUS.ERROR:
      return 'failed';
    case BAILEYS_ACK_STATUS.PENDING:
      return 'pending';
    case BAILEYS_ACK_STATUS.SERVER_ACK:
      return 'server_ack';
    case BAILEYS_ACK_STATUS.DELIVERY_ACK:
      return 'delivery_ack';
    case BAILEYS_ACK_STATUS.READ:
    case BAILEYS_ACK_STATUS.PLAYED:
      return 'read';
    default:
      // Valor desconhecido/futuro do proprio Baileys - ignora em vez de
      // gravar algo incorreto (o chamador deve pular a atualizacao).
      return null;
  }
}
