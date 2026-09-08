// src/modules/auth/infra/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Inject } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { AuthenticatedUser } from '../../../../shared/types/express';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  cargo?: string | null;
  standId?: string | null;
  impersonadoPor?: string | null;
  // tv = tokenVersion: presente em todos os tokens emitidos apos a
  // implementacao de revogacao (logout / troca de senha). Tokens legados
  // sem este campo sao rejeitados para forcar novo login.
  tv?: number | null;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[FATAL] JWT_SECRET nao esta configurado no .env. ' +
      'Defina uma chave longa e aleatoria antes de iniciar o servidor.',
    );
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) implements OnModuleInit {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  onModuleInit() {
    this.logger.log('JWT_SECRET carregado com sucesso.');
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload?.tenantId) {
      throw new UnauthorizedException('Token invalido.');
    }

    // Tokens de impersonacao (Super Usuario) nao passam pelo check de
    // tokenVersion — sao de curta duracao (2h) e emitidos por fluxo proprio.
    if (!payload.impersonadoPor) {
      // Tokens sem tv (emitidos antes desta versao) sao rejeitados.
      // O usuario precisa fazer login novamente.
      if (payload.tv == null) {
        throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuario nao encontrado.');
      }

      // tokenVersion divergente = sessao revogada (logout ou troca de senha).
      if (user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException('Sessao encerrada. Faca login novamente.');
      }
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      cargo: payload.cargo ?? null,
      standId: payload.standId ?? null,
      impersonadoPor: payload.impersonadoPor ?? null,
    };
  }
}
