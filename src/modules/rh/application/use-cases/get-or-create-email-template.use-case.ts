// src/modules/rh/application/use-cases/get-or-create-email-template.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IEmailTemplateRepository,
  EmailTemplateRecord,
} from '../../domain/repositories/email-template-repository.interface';
import { EmailTemplateTipo } from '../../domain/services/email-template-tipos';
import { EMAIL_TEMPLATE_PADRAO } from '../../domain/services/email-template-padrao';

interface GetOrCreateEmailTemplateInput {
  tenantId: string;
  tipo: EmailTemplateTipo;
}

// Evita depender de setup manual: a primeira vez que um tenant precisa de
// um template (leitura pela UI OU pelo proprio envio do e-mail) e ainda
// nao existe linha para esse tipo, cria automaticamente com o texto
// padrao (mesmo padrao ja usado por GetOrCreateContratoTemplateUseCase/
// GetOrCreateViviConfigUseCase).
@Injectable()
export class GetOrCreateEmailTemplateUseCase {
  constructor(
    @Inject('IEmailTemplateRepository') private readonly emailTemplateRepository: IEmailTemplateRepository,
  ) {}

  async execute(input: GetOrCreateEmailTemplateInput): Promise<EmailTemplateRecord> {
    const existente = await this.emailTemplateRepository.findByTenantAndTipo(input.tenantId, input.tipo);
    if (existente) {
      return existente;
    }

    const padrao = EMAIL_TEMPLATE_PADRAO[input.tipo];
    return this.emailTemplateRepository.create({
      tenantId: input.tenantId,
      tipo: input.tipo,
      assunto: padrao.assunto,
      corpo: padrao.corpo,
    });
  }
}
