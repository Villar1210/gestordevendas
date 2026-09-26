import { UnauthorizedException } from '@nestjs/common';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import { ResetPasswordUseCase } from './reset-password.use-case';
import { LoginAttemptsService } from '../services/login-attempts.service';
import { hashTokenRedefinicao } from '../../domain/services/password-reset-token';

const flush = () => new Promise((r) => setImmediate(r));

function montar() {
  const user = { id: 'u1', email: 'maria@teste.com', name: 'Maria <b>Silva</b>' };
  const tokens: { id: string; userId: string; token: string; expiresAt: Date; used: boolean }[] = [];
  const userRepository = {
    findByEmail: jest.fn(async (e: string) => (e === user.email ? user : null)),
    findById: jest.fn(async () => user),
    updatePassword: jest.fn(async () => undefined),
  };
  const tokenRepository = {
    invalidateAllForUser: jest.fn(async () => tokens.forEach((t) => (t.used = true))),
    create: jest.fn(async (i: { userId: string; token: string; expiresAt: Date }) => {
      tokens.push({ id: `t${tokens.length}`, used: false, ...i });
    }),
    findByToken: jest.fn(async (h: string) => tokens.find((t) => t.token === h) ?? null),
    consumir: jest.fn(async (id: string) => {
      const t = tokens.find((x) => x.id === id);
      if (!t || t.used) return false;
      t.used = true;
      return true;
    }),
  };
  const emails: { to: string; subject: string; body: string }[] = [];
  const emailSender = { send: jest.fn(async (e: { to: string; subject: string; body: string }) => void emails.push(e)) };
  const attempts = new LoginAttemptsService();
  const pedir = new RequestPasswordResetUseCase(userRepository as never, tokenRepository as never, emailSender as never);
  const redefinir = new ResetPasswordUseCase(userRepository as never, tokenRepository as never, attempts);
  const tokenDoEmail = () => /token=([a-f0-9]{64})/.exec(emails[emails.length - 1].body)![1];
  return { user, tokens, emails, pedir, redefinir, attempts, userRepository, tokenDoEmail };
}

describe('Recuperacao de senha', () => {
  it('guarda so o hash do token e envia o original no link, com nome escapado', async () => {
    const c = montar();
    await c.pedir.execute({ email: 'Maria@Teste.com' });
    await flush();
    expect(c.emails).toHaveLength(1);
    const token = c.tokenDoEmail();
    expect(c.tokens[0].token).toBe(hashTokenRedefinicao(token));
    expect(c.tokens[0].token).not.toBe(token);
    expect(c.emails[0].subject).toBe('Redefinição de senha – Gestor de Vendas');
    expect(c.emails[0].body).toContain('Maria');
    expect(c.emails[0].body).not.toContain('<b>');
  });

  it('e-mail sem cadastro nao envia nada e nao falha', async () => {
    const c = montar();
    await expect(c.pedir.execute({ email: 'ninguem@teste.com' })).resolves.toBeUndefined();
    await flush();
    expect(c.emails).toHaveLength(0);
  });

  it('ignora novo pedido para o mesmo e-mail dentro de 1 minuto', async () => {
    const c = montar();
    await c.pedir.execute({ email: 'maria@teste.com' });
    await c.pedir.execute({ email: 'MARIA@teste.com' });
    await flush();
    expect(c.emails).toHaveLength(1);
  });

  it('troca a senha, consome o link e libera o bloqueio de login', async () => {
    const c = montar();
    for (let i = 0; i < 5; i++) c.attempts.registrarFalhaLogin(c.user.email);
    expect(c.attempts.minutosBloqueado(c.user.email)).toBeGreaterThan(0);
    await c.pedir.execute({ email: c.user.email });
    await flush();
    const token = c.tokenDoEmail();
    await c.redefinir.execute({ token, newPassword: 'NovaSenha123' });
    expect(c.userRepository.updatePassword).toHaveBeenCalledTimes(1);
    expect(c.attempts.minutosBloqueado(c.user.email)).toBe(0);
    await expect(c.redefinir.execute({ token, newPassword: 'OutraSenha123' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('dois usos simultaneos do mesmo link: so um troca a senha', async () => {
    const c = montar();
    await c.pedir.execute({ email: c.user.email });
    await flush();
    const token = c.tokenDoEmail();
    const r = await Promise.allSettled([
      c.redefinir.execute({ token, newPassword: 'NovaSenha123' }),
      c.redefinir.execute({ token, newPassword: 'NovaSenha456' }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(c.userRepository.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('link expirado ou com o valor do banco (hash) nao funciona', async () => {
    const c = montar();
    await c.pedir.execute({ email: c.user.email });
    await flush();
    await expect(c.redefinir.execute({ token: c.tokens[0].token, newPassword: 'NovaSenha123' })).rejects.toThrow(
      'inválido',
    );
    c.tokens[0].expiresAt = new Date(Date.now() - 1000);
    await expect(c.redefinir.execute({ token: c.tokenDoEmail(), newPassword: 'NovaSenha123' })).rejects.toThrow(
      'inválido',
    );
  });
});
