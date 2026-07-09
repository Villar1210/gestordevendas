// src/shared/infra/http/decorators/roles.decorator.ts
// Usado junto com RolesGuard: @Roles('Administrador', 'Corretor') acima de
// um controller ou metodo restringe o acesso a esses roles (o valor de
// req.user.role, ja embutido no JWT).
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
