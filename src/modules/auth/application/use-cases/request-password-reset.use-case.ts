// src/modules/auth/application/use-cases/request-password-reset.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';

interface RequestPasswordResetInput {
  email: string;
}

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordResetTokenRepository')
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email);

    // Por seguranca, nunca revelamos se o e-mail existe ou nao: retorno
    // sempre "sucesso silencioso" para quem chama este metodo.
    if (!user) {
      return;
    }

    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.passwordResetTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    await this.emailSender.send({
      to: user.email,
      subject: 'Redefinicao de senha',
      body: `<p>Ola, ${user.name}.</p><p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo para continuar (valido por 15 minutos):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se voce nao pediu isso, ignore este e-mail.</p>`,
    });
  }
}
