// src/modules/rh/application/use-cases/rejeitar-cadastro.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { ITenantConfigRepository } from '../../../configuracoes/domain/repositories/tenant-config-repository.interface';
import { GetOrCreateEmailTemplateUseCase } from './get-or-create-email-template.use-case';
import { preencherEmailTemplate } from '../../domain/services/preencher-email-template';

interface RejeitarCadastroInput {
  cadastroId: string;
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class RejeitarCadastroUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
    @Inject('ITenantConfigRepository') private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly getOrCreateEmailTemplateUseCase: GetOrCreateEmailTemplateUseCase,
  ) {}

  async execute(input: RejeitarCadastroInput): Promise<CadastroRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode rejeitar cadastros.');
    }

    const cadastro = await this.cadastroRepository.findByIdAndTenant(
      input.cadastroId,
      input.tenantId,
    );
    if (!cadastro) {
      throw new NotFoundException('Cadastro nao encontrado.');
    }
    if (cadastro.statusCadastro !== 'pendente_aprovacao') {
      throw new ConflictException('Este cadastro ja foi avaliado.');
    }

    const rejeitado = await this.cadastroRepository.rejeitar(input.cadastroId);

    const template = await this.getOrCreateEmailTemplateUseCase.execute({
      tenantId: input.tenantId,
      tipo: 'rejeicao_cadastro',
    });
    const tenantConfig = await this.tenantConfigRepository.findByTenantId(input.tenantId);
    const dadosTemplate = {
      nome: rejeitado.name,
      email: rejeitado.email,
      empresa: tenantConfig?.name ?? 'nossa empresa',
    };

    await this.emailSender.send({
      to: rejeitado.email,
      subject: preencherEmailTemplate(template.assunto, dadosTemplate),
      body: preencherEmailTemplate(template.corpo, dadosTemplate),
    });

    return rejeitado;
  }
}
