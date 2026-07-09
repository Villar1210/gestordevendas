// src/shared/infra/http/guards/roles.guard.ts
// Complementar ao JwtAuthGuard (sempre usado DEPOIS dele - precisa de
// req.user ja preenchido). Sem @Roles(...) no metodo/controller, libera
// qualquer role autenticado (mesmo comportamento de antes desta guard existir).
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.user?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException('Voce nao tem permissao para acessar este recurso.');
    }

    return true;
  }
}
