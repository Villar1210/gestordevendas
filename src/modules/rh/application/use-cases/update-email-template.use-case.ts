// src/modules/rh/application/use-cases/update-email-template.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IEmailTemplateRepository,
  EmailTemplateRecord,
} from '../../domain/repositories/email-template-repository.interface';
import { EmailTemplateTipo, isValidEmailTemplateTipo } from '../../domain/services/email-template-tipos';
import { GetOrCreateEmailTemplateUseCase } from './get-or-create-email-template.use-case';

interface UpdateEmailTemplateInput {
  tenantId: string;
  requesterRole: string;
  tipo: string;
  assunto: string;
  corpo: string;
}

@Injectable()
export class UpdateEmailTemplateUseCase {
  constructor(
    @Inject('IEmailTemplateRepository') private readonly emailTemplateRepository: IEmailTemplateRepository,
    private readonly getOrCreateEmailTemplateUseCase: GetOrCreateEmailTemplateUseCase,
  ) {}

  async execute(input: UpdateEmailTemplateInput): Promise<EmailTemplateRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar templates de e-mail.');
    }
    if (!isValidEmailTemplateTipo(input.tipo)) {
      throw new BadRequestException('Tipo de template invalido.');
    }
    if (!input.assunto.trim() || !input.corpo.trim()) {
      throw new BadRequestException('Assunto e corpo do e-mail nao podem ficar vazios.');
    }

    const existente = await this.getOrCreateEmailTemplateUseCase.execute({
      tenantId: input.tenantId,
      tipo: input.tipo as EmailTemplateTipo,
    });

    return this.emailTemplateRepository.update(existente.id, {
      assunto: input.assunto,
      corpo: input.corpo,
    });
  }
}
