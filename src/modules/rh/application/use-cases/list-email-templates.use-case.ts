// src/modules/rh/application/use-cases/list-email-templates.use-case.ts
// Aba "Templates de E-mail" do Painel Administrativo - lista os 3 tipos
// (get-or-create cada um, para a tela sempre mostrar os 3 mesmo antes de
// qualquer e-mail ter sido disparado).
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { EmailTemplateRecord } from '../../domain/repositories/email-template-repository.interface';
import { EMAIL_TEMPLATE_TIPOS } from '../../domain/services/email-template-tipos';
import { GetOrCreateEmailTemplateUseCase } from './get-or-create-email-template.use-case';

interface ListEmailTemplatesInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class ListEmailTemplatesUseCase {
  constructor(private readonly getOrCreateEmailTemplateUseCase: GetOrCreateEmailTemplateUseCase) {}

  async execute(input: ListEmailTemplatesInput): Promise<EmailTemplateRecord[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver os templates de e-mail.');
    }

    return Promise.all(
      EMAIL_TEMPLATE_TIPOS.map((tipo) =>
        this.getOrCreateEmailTemplateUseCase.execute({ tenantId: input.tenantId, tipo }),
      ),
    );
  }
}
