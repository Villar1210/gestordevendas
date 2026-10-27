// Fase A (27/10/2026): POST /auth/register deixou de ser publico - so o
// Super Usuario cria empresas (tenants) novas.
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

describe('POST /auth/register', () => {
  it('exige login + papel Super Usuario', () => {
    const handler = AuthController.prototype.register;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    const roles = Reflect.getMetadataKeys(handler)
      .map((k) => Reflect.getMetadata(k, handler))
      .find((v) => Array.isArray(v) && v.includes(SUPER_USUARIO_ROLE_NAME));
    expect(roles).toEqual([SUPER_USUARIO_ROLE_NAME]);
  });
});
