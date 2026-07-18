// src/modules/auth/infra/strategies/jwt.strategy.ts
// Substitui o middleware manual de JWT por um Guard nativo e testavel do NestJS.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../../shared/types/express';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  // Ausente em tokens emitidos antes do RBAC por cargo - `validate` abaixo
  // trata `undefined` como `null` (fallback seguro, nunca quebra).
  cargo?: string | null;
  // Ausente em tokens emitidos antes do modulo Plantao/Stand - mesmo
  // fallback seguro de `cargo` acima.
  standId?: string | null;
  // Presente SO em tokens emitidos por ImpersonarTenantUseCase (modulo
  // super_usuario) - guarda o id do Super Usuario que gerou este acesso.
  // Ausente em qualquer login normal.
  impersonadoPor?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret-fallback',
    });
  }

  // O retorno deste metodo vira automaticamente req.user
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload?.tenantId) {
      throw new UnauthorizedException('Token invalido.');
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
