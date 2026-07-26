// src/modules/whatsappmarketing/domain/repositories/whatsapp-message-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
import { StatusEntrega } from '../services/map-delivery-status';

export type WhatsAppMessageDirection = 'IN' | 'OUT';

export interface WhatsAppMessageRecord {
  id: string;
  direction: WhatsAppMessageDirection;
  body: string;
  timestamp: Date;
  // JID completo do Baileys (com sufixo @lid ou @s.whatsapp.net). Nulo em
  // mensagens salvas antes desse campo existir.
  remoteJid: string | null;
}

export interface IWhatsAppMessageRepository {
  create(input: {
    tenantId: string;
    sessionId: string;
    direction: WhatsAppMessageDirection;
    fromNumber: string;
    toNumber: string;
    remoteJid?: string | null;
    body: string;
    timestamp: Date;
    // ID da mensagem no Baileys (msg.key.id) - ver comentario no schema.
    // Preenchido tanto em IN (dedupe da recuperacao de historico) quanto em
    // OUT (correlacionar com messages.update para statusEntrega abaixo).
    baileysMessageId?: string | null;
    // So relevante em mensagens OUT ("pending" no momento do envio) - ver
    // comentario no schema. Nulo em IN.
    statusEntrega?: StatusEntrega | null;
  }): Promise<void>;
  // Ultimas mensagens trocadas com um numero especifico dentro de uma sessao,
  // em ordem cronologica (mais antiga primeiro) - usado pela VIVI para montar
  // o historico da conversa.
  findRecentBySessionAndNumber(
    sessionId: string,
    phoneNumber: string,
    limit: number,
  ): Promise<WhatsAppMessageRecord[]>;
  // Usado pelo job de inatividade do Repique (modulo vendas_kanban,
  // MoverLeadsInativosParaRepiqueUseCase) - a mensagem mais recente (IN ou
  // OUT, qualquer sessao) trocada com esse numero neste tenant. IN = o
  // lead respondeu; OUT = mensagem automatica (ex: VIVI) - as duas contam
  // como "interacao recente" para o job nao mover o card indevidamente.
  findMostRecentByTenantAndPhone(
    tenantId: string,
    phoneNumber: string,
  ): Promise<{ timestamp: Date } | null>;
  // Dedupe da recuperacao de mensagens perdidas durante desconexao (evento
  // messaging-history.set, ver BaileysWhatsAppProvider): dado um lote de
  // IDs candidatos, devolve so os que JA existem gravados nesta sessao -
  // 1 consulta para o lote inteiro, em vez de 1 por mensagem.
  findExistingBaileysMessageIds(
    sessionId: string,
    baileysMessageIds: string[],
  ): Promise<string[]>;
  // Confirmacao de entrega (evento messages.update do Baileys, ver
  // BaileysWhatsAppProvider): atualiza o statusEntrega da mensagem OUT
  // correspondente a esse baileysMessageId nesta sessao. updateMany (nao
  // update) de proposito - nao lanca erro se a mensagem ainda nao tiver
  // sido persistida quando o evento chegar (defensivo contra corrida),
  // nem se o id nao for reconhecido (mensagem de outra natureza/antiga).
  updateStatusEntregaByBaileysMessageId(
    sessionId: string,
    baileysMessageId: string,
    statusEntrega: StatusEntrega,
  ): Promise<void>;
}
