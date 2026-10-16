// JwtStrategy.validate: role/cargo vem do BANCO para tokens normais
// (promocao/rebaixamento vale sem relogar); token de impersonacao continua
// usando o payload, sem consultar o banco.
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function setup(user: Record<string, unknown> | null) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';
  const userRepository = { findById: jest.fn(async () => user) };
  const strategy = new JwtStrategy(userRepository as never);
  return { strategy, userRepository };
}

const payloadGerente = {
  sub: 'u-1',
  tenantId: 't-1',
  role: 'Corretor',
  cargo: 'gerente',
  standId: null,
  tv: 3,
};

describe('JwtStrategy.validate', () => {
  it('usuario rebaixado (gerente -> corretor no banco) perde o poder sem relogar', async () => {
    const { strategy } = setup({ id: 'u-1', tokenVersion: 3, role: { name: 'Corretor' }, cargoHierarquico: 'corretor' });
    const user = await strategy.validate(payloadGerente);
    expect(user.role).toBe('Corretor');
    expect(user.cargo).toBe('corretor');
  });

  it('cargo removido no banco vira null; role trocada no banco vale na hora', async () => {
    const { strategy } = setup({ id: 'u-1', tokenVersion: 3, role: { name: 'Corretor Parceiro' }, cargoHierarquico: null });
    const user = await strategy.validate({ ...payloadGerente, role: 'Administrador' });
    expect(user.role).toBe('Corretor Parceiro');
    expect(user.cargo).toBeNull();
  });

  it('promocao no banco vale na hora', async () => {
    const { strategy } = setup({ id: 'u-1', tokenVersion: 3, role: { name: 'Corretor' }, cargoHierarquico: 'diretor' });
    const user = await strategy.validate({ ...payloadGerente, cargo: 'corretor' });
    expect(user.cargo).toBe('diretor');
  });

  it('tokenVersion divergente continua derrubando a sessao', async () => {
    const { strategy } = setup({ id: 'u-1', tokenVersion: 4, role: { name: 'Corretor' }, cargoHierarquico: 'gerente' });
    await expect(strategy.validate(payloadGerente)).rejects.toThrow(UnauthorizedException);
  });

  it('impersonacao: inalterada (usa o payload e nao consulta o banco)', async () => {
    const { strategy, userRepository } = setup(null);
    const user = await strategy.validate({
      sub: 'admin-do-tenant',
      tenantId: 't-2',
      role: 'Administrador',
      cargo: null,
      standId: null,
      impersonadoPor: 'super-1',
    });
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(user).toEqual({
      id: 'admin-do-tenant',
      tenantId: 't-2',
      role: 'Administrador',
      cargo: null,
      standId: null,
      impersonadoPor: 'super-1',
    });
  });
});
