// src/modules/whatsappmarketing/domain/repositories/whatsapp-session-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface WhatsAppSessionRecord {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  label: string;
  status: string;
  phoneNumber: string | null;
  // Marca se esta sessao e atendida pela VIVI (modulo vivi_sdr) em vez do
  // corretor humano dono do numero.
  isAiEnabled: boolean;
}

export interface IWhatsAppSessionRepository {
  create(input: {
    tenantId: string;
    ownerUserId?: string | null;
    label: string;
  }): Promise<WhatsAppSessionRecord>;
  findById(id: string): Promise<WhatsAppSessionRecord | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<WhatsAppSessionRecord | null>;
  // Sessao mais recente do tenant (independente do status), ou null se nao existir nenhuma.
  findMostRecentByTenant(tenantId: string): Promise<WhatsAppSessionRecord | null>;
  updateStatus(id: string, status: string, phoneNumber?: string | null): Promise<void>;
  updateAiEnabled(id: string, isAiEnabled: boolean): Promise<void>;
}
