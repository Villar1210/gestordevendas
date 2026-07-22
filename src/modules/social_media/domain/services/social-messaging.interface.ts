// src/modules/social_media/domain/services/social-messaging.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe a Graph API da
// Meta. Usado por MessageDispatcherService (shared/) para os canais
// INSTAGRAM/FACEBOOK - envia a mensagem de verdade E persiste o
// SocialMessage (direction OUT), mesma dupla responsabilidade que
// SendWhatsAppMessageUseCase tem hoje para o WhatsApp (ver
// BaileysWhatsAppProvider.sendMessage).

export interface EnviarSocialMessagingInput {
  tenantId: string;
  socialAccountId: string;
  // PSID (Messenger) ou IGSID (Instagram) do destinatario.
  destinatarioExternalId: string;
  conteudo: string;
}

export interface ISocialMessagingService {
  enviar(input: EnviarSocialMessagingInput): Promise<void>;
}
