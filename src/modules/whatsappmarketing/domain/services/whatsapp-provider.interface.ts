// src/modules/whatsappmarketing/domain/services/whatsapp-provider.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Baileys, Meta Cloud API, etc.

export interface IWhatsAppProvider {
  createSession(sessionId: string): Promise<void>;
  getQrCode(sessionId: string): Promise<string | null>;
  // "to" aceita, preferencialmente, um JID completo (ex: "123@lid" ou
  // "5511999999999@s.whatsapp.net"), usado como esta. Se vier so digitos
  // (sem "@"), cai no fallback de montar "<digitos>@s.whatsapp.net" -
  // mantido para compatibilidade com o envio manual (formulario), que so
  // tem o numero de telefone digitado, nunca o JID completo do WhatsApp.
  sendMessage(sessionId: string, to: string, body: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
}
