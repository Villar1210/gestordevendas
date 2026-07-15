// src/modules/rh/application/use-cases/create-corretor.use-case.ts
import { Injectable, Inject, ForbiddenException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ICorretorRepository, CorretorRecord } from '../../domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { ITenantConfigRepository } from '../../../configuracoes/domain/repositories/tenant-config-repository.interface';
import { GetOrCreateEmailTemplateUseCase } from './get-or-create-email-template.use-case';
import { preencherEmailTemplate } from '../../domain/services/preencher-email-template';

const CORRETOR_ROLE_NAME = 'Corretor';

interface CreateCorretorInput {
  tenantId: string;
  requesterRole: string;
  name: string;
  email: string;
  password?: string;
}

function generateTemporaryPassword(): string {
  // 12 caracteres legiveis (hex), suficiente para uma senha temporaria de
  // uso unico - o corretor deve troca-la apos o primeiro login.
  return crypto.randomBytes(9).toString('hex');
}

@Injectable()
export class CreateCorretorUseCase {
  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
    @Inject('IRoleRepository') private readonly roleRepository: IRoleRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
    @Inject('ITenantConfigRepository') private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly getOrCreateEmailTemplateUseCase: GetOrCreateEmailTemplateUseCase,
  ) {}

  async execute(input: CreateCorretorInput): Promise<CorretorRecord> {
    // So Administrador pode cadastrar corretores.
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode cadastrar corretores.');
    }

    const existing = await this.corretorRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Ja existe um usuario cadastrado com este e-mail.');
    }

    let role = await this.roleRepository.findByTenantAndName(input.tenantId, CORRETOR_ROLE_NAME);
    if (!role) {
      role = await this.roleRepository.create({
        tenantId: input.tenantId,
        name: CORRETOR_ROLE_NAME,
      });
    }

    const temporaryPassword = input.password?.trim() || generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const corretor = await this.corretorRepository.create({
      tenantId: input.tenantId,
      roleId: role.id,
      name: input.name,
      email: input.email,
      hashedPassword,
    });

    const template = await this.getOrCreateEmailTemplateUseCase.execute({
      tenantId: input.tenantId,
      tipo: 'boas_vindas_corretor',
    });
    const tenantConfig = await this.tenantConfigRepository.findByTenantId(input.tenantId);
    const dadosTemplate = {
      nome: corretor.name,
      email: corretor.email,
      empresa: tenantConfig?.name ?? 'nossa empresa',
      senhaTemporaria: temporaryPassword,
    };

    await this.emailSender.send({
      to: corretor.email,
      subject: preencherEmailTemplate(template.assunto, dadosTemplate),
      body: preencherEmailTemplate(template.corpo, dadosTemplate),
    });

    return corretor;
  }
}
