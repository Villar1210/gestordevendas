// src/modules/auth/application/use-cases/verify-two-factor-code.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { ITwoFactorCodeRepository } from '../../domain/repositories/two-factor-code-repository.interface';
import { LoginAttemptsService } from '../services/login-attempts.service';

interface VerifyTwoFactorCodeInput {
  challengeId: string;
  code: string;
}

@Injectable()
export class VerifyTwoFactorCodeUseCase {
  constructor(
    @Inject('ITwoFactorCodeRepository')
    private readonly twoFactorCodeRepository: ITwoFactorCodeRepository,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly loginAttempts: LoginAttemptsService,
  ) {}

  async execute(input: VerifyTwoFactorCodeInput) {
    const record = await this.twoFactorCodeRepository.findById(input.challengeId);

    if (
      !record ||
      record.used ||
      record.expiresAt < new Date() ||
      record.code !== input.code
    ) {
      // Codigo errado: conta a tentativa. Na 5a, o codigo e invalidado e a
      // pessoa precisa pedir um novo (evita "chutar" os 6 digitos).
      if (record && !record.used && record.code !== input.code) {
        const esgotou = this.loginAttempts.registrarFalhaCodigo(record.id);
        if (esgotou) {
          await this.twoFactorCodeRepository.markAsUsed(record.id);
          this.loginAttempts.limparCodigo(record.id);
          throw new UnauthorizedException('Código bloqueado após várias tentativas. Clique em "Reenviar código".');
        }
      }
      throw new UnauthorizedException('Código inválido ou expirado.');
    }
    this.loginAttempts.limparCodigo(record.id);

    const user = await this.userRepository.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('Codigo invalido ou expirado.');
    }

    await this.twoFactorCodeRepository.markAsUsed(record.id);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role.name,
      cargo: user.cargoHierarquico,
      standId: user.standId,
      tv: user.tokenVersion,
    };

    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        cargoHierarquico: user.cargoHierarquico,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    };
  }
}
