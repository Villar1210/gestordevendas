// src/modules/social_media/domain/repositories/social-message-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
// Historico bruto de DMs (Instagram/Facebook) - papel paralelo ao de
// IWhatsAppMessageRepository (modulo whatsappmarketing), ver comentario do
// model SocialMessage em schema.prisma para o motivo de nao reaproveitar a
// tabela whatsapp_messages.

export interface SocialMessageRecord {
  id: string;
  tenantId: string;
  socialAccountId: string;
  direction: 'IN' | 'OUT';
  identificadorExterno: string;
  body: string;
  timestamp: Date;
  createdAt: Date;
}

export interface CreateSocialMessageInput {
  tenantId: string;
  socialAccountId: string;
  direction: 'IN' | 'OUT';
  identificadorExterno: string;
  body: string;
  timestamp: Date;
}

export interface ISocialMessageRepository {
  create(input: CreateSocialMessageInput): Promise<SocialMessageRecord>;
  // Ordenado cronologicamente (mais antiga primeiro) - mesma convencao de
  // IWhatsAppMessageRepository.findRecentBySessionAndNumber, usada pela VIVI
  // (ProcessIncomingSocialMessageUseCase) para montar o historico da IA.
  findRecentByAccountAndExternalId(
    socialAccountId: string,
    identificadorExterno: string,
    limit: number,
  ): Promise<SocialMessageRecord[]>;
}
