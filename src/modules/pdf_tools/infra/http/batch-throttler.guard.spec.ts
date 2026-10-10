import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { PdfToolsBatchThrottlerGuard } from './batch-throttler.guard';

class Controller {
  compress() {}
  rotate() {}
}

function ctx(user: { id: string } | undefined, ip: string, handler: 'compress' | 'rotate' = 'compress') {
  const res = { header: jest.fn() };
  const req = { user, ip, headers: {} };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getClass: () => Controller,
    getHandler: () => Controller.prototype[handler],
  } as unknown as ExecutionContext;
}

describe('PdfToolsBatchThrottlerGuard', () => {
  let storage: ThrottlerStorageService;
  let guard: PdfToolsBatchThrottlerGuard;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    guard = new PdfToolsBatchThrottlerGuard([{ name: 'default', ttl: 60_000, limit: 100 }], storage, new Reflector());
  });
  afterEach(() => storage.onApplicationShutdown());

  it('6 por minuto POR USUARIO; o 7o recebe mensagem em portugues', async () => {
    for (let i = 0; i < 6; i++) await expect(guard.canActivate(ctx({ id: 'u1' }, '10.0.0.1'))).resolves.toBe(true);
    const err = await guard.canActivate(ctx({ id: 'u1' }, '10.0.0.1')).catch((e) => e);
    expect(err).toBeInstanceOf(ThrottlerException);
    expect(err.message).toMatch(/^Muitos envios em pouco tempo: são no máximo 6 por minuto/);
  });

  it('nao e por IP: outro usuario no MESMO IP continua liberado; o mesmo usuario em outro IP continua bloqueado', async () => {
    for (let i = 0; i < 6; i++) await guard.canActivate(ctx({ id: 'u1' }, '10.0.0.1'));
    await expect(guard.canActivate(ctx({ id: 'u2' }, '10.0.0.1'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ id: 'u1' }, '192.168.0.9'))).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('contagem separada por ferramenta; sem usuario cai no IP', async () => {
    for (let i = 0; i < 6; i++) await guard.canActivate(ctx({ id: 'u1' }, '10.0.0.1', 'compress'));
    await expect(guard.canActivate(ctx({ id: 'u1' }, '10.0.0.1', 'rotate'))).resolves.toBe(true);
    for (let i = 0; i < 6; i++) await guard.canActivate(ctx(undefined, '10.0.0.7'));
    await expect(guard.canActivate(ctx(undefined, '10.0.0.7'))).rejects.toBeInstanceOf(ThrottlerException);
    await expect(guard.canActivate(ctx(undefined, '10.0.0.8'))).resolves.toBe(true);
  });
});
