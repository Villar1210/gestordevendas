// src/modules/rh/infra/database/prisma-email-template.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IEmailTemplateRepository,
  EmailTemplateRecord,
} from '../../domain/repositories/email-template-repository.interface';
import { EmailTemplateTipo } from '../../domain/services/email-template-tipos';

@Injectable()
export class PrismaEmailTemplateRepository implements IEmailTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantAndTipo(
    tenantId: string,
    tipo: EmailTemplateTipo,
  ): Promise<EmailTemplateRecord | null> {
    return this.prisma.emailTemplate.findUnique({
      where: { tenantId_tipo: { tenantId, tipo } },
    });
  }

  async findAllByTenant(tenantId: string): Promise<EmailTemplateRecord[]> {
    return this.prisma.emailTemplate.findMany({ where: { tenantId } });
  }

  async create(input: {
    tenantId: string;
    tipo: EmailTemplateTipo;
    assunto: string;
    corpo: string;
  }): Promise<EmailTemplateRecord> {
    return this.prisma.emailTemplate.create({
      data: {
        tenantId: input.tenantId,
        tipo: input.tipo,
        assunto: input.assunto,
        corpo: input.corpo,
      },
    });
  }

  async update(id: string, input: { assunto: string; corpo: string }): Promise<EmailTemplateRecord> {
    return this.prisma.emailTemplate.update({
      where: { id },
      data: { assunto: input.assunto, corpo: input.corpo },
    });
  }
}
