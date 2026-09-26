// src/modules/auth/application/use-cases/reset-password.use-case.ts
import { BadRequestException, Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token-repository.interface';
import { hashTokenRedefinicao } from '../../domain/services/password-reset-token';
import { LoginAttemptsService } from '../services/login-attempts.service';

interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

const LINK_INVALIDO = 'Este link é inválido ou já expirou. Peça um novo em "Esqueci minha senha".';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordResetTokenRepository')
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    private readonly loginAttempts: LoginAttemptsService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    // bcrypt so considera os primeiros 72 BYTES (letras acentuadas ocupam
    // 2) - alem disso o resto da senha seria ignorado sem aviso.
    if (Buffer.byteLength(input.newPassword, 'utf8') > 72) {
      throw new BadRequestException('Senha longa demais. Use até 72 caracteres (acentos contam em dobro).');
    }

    const resetToken = await this.passwordResetTokenRepository.findByToken(
      hashTokenRedefinicao(input.token),
    );

    // Mensagem unica para inexistente, usado ou expirado: nao revela o motivo.
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException(LINK_INVALIDO);
    }

    // Consome o link ANTES de trocar a senha: se duas requisicoes chegarem
    // juntas com o mesmo link, so a primeira passa daqui.
    if (!(await this.passwordResetTokenRepository.consumir(resetToken.id))) {
      throw new UnauthorizedException(LINK_INVALIDO);
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);
    // updatePassword tambem derruba todas as sessoes abertas (tokenVersion).
    await this.userRepository.updatePassword(resetToken.userId, hashedPassword);

    // Quem estava bloqueado por errar a senha ja provou ser o dono do e-mail.
    const user = await this.userRepository.findById(resetToken.userId);
    if (user) this.loginAttempts.limparLogin(user.email);
  }
}
