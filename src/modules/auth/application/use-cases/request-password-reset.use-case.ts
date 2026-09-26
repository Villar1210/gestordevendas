// src/modules/auth/application/use-cases/request-password-reset.use-case.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import {
  PASSWORD_RESET_TTL_MS,
  gerarTokenRedefinicao,
  hashTokenRedefinicao,
} from '../../domain/services/password-reset-token';
import { montarEmailRedefinicaoSenha } from '../templates/redefinicao-senha.email';

interface RequestPasswordResetInput {
  email: string;
}

// Intervalo minimo entre dois e-mails de redefinicao para o MESMO endereco
// (o limite por IP fica no controller). Evita encher a caixa de alguem.
const INTERVALO_MINIMO_MS = 60 * 1000;

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);
  private readonly ultimoEnvio = new Map<string, number>();

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordResetTokenRepository')
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  // Responde na hora, SEMPRE do mesmo jeito: nem a mensagem nem o tempo de
  // resposta podem revelar se o e-mail tem conta. O trabalho real (banco +
  // envio) acontece em segundo plano.
  async execute(input: RequestPasswordResetInput): Promise<void> {
    const email = input.email.trim();
    const chave = email.toLowerCase();
    const agora = Date.now();

    const anterior = this.ultimoEnvio.get(chave);
    if (anterior && agora - anterior < INTERVALO_MINIMO_MS) return;
    this.ultimoEnvio.set(chave, agora);
    this.limparAntigos(agora);

    void this.processar(email).catch((err: unknown) => {
      this.logger.error(
        `Falha ao processar redefinicao de senha: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async processar(email: string): Promise<void> {
    // Tenta como digitado e, se nao achar, em minusculas (quem digita
    // "Maria@..." para uma conta "maria@..." tambem recebe o link).
    const user =
      (await this.userRepository.findByEmail(email)) ??
      (email !== email.toLowerCase() ? await this.userRepository.findByEmail(email.toLowerCase()) : null);
    if (!user) return;

    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);

    const token = gerarTokenRedefinicao();
    await this.passwordResetTokenRepository.create({
      userId: user.id,
      token: hashTokenRedefinicao(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    const urlPlataforma = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const { subject, body } = montarEmailRedefinicaoSenha({
      nome: user.name,
      link: `${urlPlataforma}/reset-password?token=${token}`,
      urlPlataforma,
      validadeMinutos: PASSWORD_RESET_TTL_MS / 60_000,
    });

    await this.emailSender.send({ to: user.email, subject, body });
  }

  private limparAntigos(agora: number): void {
    if (this.ultimoEnvio.size < 1000) return;
    for (const [chave, quando] of this.ultimoEnvio) {
      if (agora - quando >= INTERVALO_MINIMO_MS) this.ultimoEnvio.delete(chave);
    }
  }
}
