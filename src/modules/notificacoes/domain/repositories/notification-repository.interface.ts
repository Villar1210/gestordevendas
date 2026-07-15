// src/modules/notificacoes/domain/repositories/notification-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface NotificationRecord {
  id: string;
  tenantId: string;
  userId: string;
  tipo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  createdAt: Date;
}

export interface INotificationRepository {
  create(input: {
    tenantId: string;
    userId: string;
    tipo: string;
    mensagem: string;
    link?: string | null;
  }): Promise<NotificationRecord>;
  findAllByUser(tenantId: string, userId: string): Promise<NotificationRecord[]>;
  findByIdAndUser(id: string, userId: string): Promise<NotificationRecord | null>;
  markAsRead(id: string): Promise<NotificationRecord>;
}
