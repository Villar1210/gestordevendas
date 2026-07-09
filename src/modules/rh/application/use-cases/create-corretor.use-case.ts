// src/modules/rh/application/use-cases/create-corretor.use-case.ts
import { Injectable, Inject, ForbiddenException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ICorretorRepository, CorretorRecord } from '../../domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';

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

    await this.emailSender.send({
      to: corretor.email,
      subject: 'Bem-vindo(a) ao gestordevendas',
      body: `<p>Ola, ${corretor.name}.</p><p>Sua conta de corretor foi criada no gestordevendas.</p><p>Acesse com o e-mail <strong>${corretor.email}</strong> e a senha temporaria abaixo. Recomendamos troca-la apos o primeiro login.</p><p><strong>Senha temporaria:</strong> ${temporaryPassword}</p>`,
    });

    return corretor;
  }
}
