// src/modules/rh/domain/repositories/email-template-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
import { EmailTemplateTipo } from '../services/email-template-tipos';

export interface EmailTemplateRecord {
  id: string;
  tenantId: string;
  tipo: string;
  assunto: string;
  corpo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailTemplateRepository {
  findByTenantAndTipo(tenantId: string, tipo: EmailTemplateTipo): Promise<EmailTemplateRecord | null>;
  findAllByTenant(tenantId: string): Promise<EmailTemplateRecord[]>;
  create(input: { tenantId: string; tipo: EmailTemplateTipo; assunto: string; corpo: string }): Promise<EmailTemplateRecord>;
  update(id: string, input: { assunto: string; corpo: string }): Promise<EmailTemplateRecord>;
}
