// src/modules/whatsappmarketing/domain/repositories/whatsapp-message-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export type WhatsAppMessageDirection = 'IN' | 'OUT';

export interface IWhatsAppMessageRepository {
  create(input: {
    tenantId: string;
    sessionId: string;
    direction: WhatsAppMessageDirection;
    fromNumber: string;
    toNumber: string;
    body: string;
    timestamp: Date;
  }): Promise<void>;
}
