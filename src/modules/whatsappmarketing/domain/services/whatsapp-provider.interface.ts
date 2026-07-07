// src/modules/whatsappmarketing/domain/services/whatsapp-provider.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Baileys, Meta Cloud API, etc.

export interface IWhatsAppProvider {
  createSession(sessionId: string): Promise<void>;
  getQrCode(sessionId: string): Promise<string | null>;
  sendMessage(sessionId: string, to: string, body: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
}
