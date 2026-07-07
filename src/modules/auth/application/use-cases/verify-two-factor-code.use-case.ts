// src/modules/auth/application/use-cases/verify-two-factor-code.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { ITwoFactorCodeRepository } from '../../domain/repositories/two-factor-code-repository.interface';

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
  ) {}

  async execute(input: VerifyTwoFactorCodeInput) {
    const record = await this.twoFactorCodeRepository.findById(input.challengeId);

    // Mensagem generica em todos os casos invalidos (nao encontrado, usado,
    // expirado ou codigo errado) para nao revelar detalhes sobre o motivo da falha.
    if (
      !record ||
      record.used ||
      record.expiresAt < new Date() ||
      record.code !== input.code
    ) {
      throw new UnauthorizedException('Codigo invalido ou expirado.');
    }

    const user = await this.userRepository.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('Codigo invalido ou expirado.');
    }

    await this.twoFactorCodeRepository.markAsUsed(record.id);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role.name,
    };

    const token = this.jwtService.sign(payload);

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
