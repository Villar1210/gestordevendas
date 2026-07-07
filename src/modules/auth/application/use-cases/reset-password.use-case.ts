// src/modules/auth/application/use-cases/reset-password.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token-repository.interface';

interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordResetTokenRepository')
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const resetToken = await this.passwordResetTokenRepository.findByToken(input.token);

    // Mensagem generica em todos os casos invalidos (nao usado, expirado ou
    // inexistente) para nao revelar detalhes sobre o motivo da falha.
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await this.userRepository.updatePassword(resetToken.userId, hashedPassword);
    await this.passwordResetTokenRepository.markAsUsed(resetToken.id);
  }
}
