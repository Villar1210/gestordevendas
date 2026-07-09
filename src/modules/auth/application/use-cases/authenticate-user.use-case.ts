// src/modules/auth/application/use-cases/authenticate-user.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { ITwoFactorCodeRepository } from '../../domain/repositories/two-factor-code-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';

interface AuthenticateInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

const TWO_FACTOR_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutos

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('ITwoFactorCodeRepository')
    private readonly twoFactorCodeRepository: ITwoFactorCodeRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: AuthenticateInput) {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    if (user.statusCadastro === 'pendente_aprovacao') {
      throw new UnauthorizedException(
        'Seu cadastro ainda esta em analise. Aguarde a aprovacao da nossa equipe.',
      );
    }
    if (user.statusCadastro === 'rejeitado') {
      throw new UnauthorizedException(
        'Seu cadastro nao foi aprovado. Entre em contato com a nossa equipe.',
      );
    }

    if (user.twoFactorEnabled) {
      await this.twoFactorCodeRepository.invalidateAllForUser(user.id);

      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      const expiresAt = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MS);

      const challengeId = await this.twoFactorCodeRepository.create({
        userId: user.id,
        code,
        expiresAt,
      });

      await this.emailSender.send({
        to: user.email,
        subject: 'Seu codigo de verificacao',
        body: `<p>Ola, ${user.name}.</p><p>Seu codigo de verificacao e:</p><h2>${code}</h2><p>Valido por 5 minutos.</p>`,
      });

      return {
        twoFactorRequired: true,
        challengeId,
      };
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role.name,
    };

    const token = input.rememberMe
      ? this.jwtService.sign(payload, { expiresIn: '30d' })
      : this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
      token,
    };
  }
}
