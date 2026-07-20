// src/modules/whatsappmarketing/domain/repositories/whatsapp-message-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

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
}
