import { LoginAttemptsService } from './login-attempts.service';

describe('LoginAttemptsService', () => {
  it('bloqueia so a conta que errou 5 vezes, por 15 minutos', () => {
    const s = new LoginAttemptsService();
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) s.registrarFalhaLogin('Ana@X.com ', t0);
    expect(s.minutosBloqueado('ana@x.com', t0)).toBe(0);
    s.registrarFalhaLogin('ana@x.com', t0);
    expect(s.minutosBloqueado('ana@x.com', t0)).toBe(15);
    expect(s.minutosBloqueado('bruno@x.com', t0)).toBe(0);
    expect(s.minutosBloqueado('ana@x.com', t0 + 15 * 60_000 + 1)).toBe(0);
  });

  it('senha certa zera o contador', () => {
    const s = new LoginAttemptsService();
    for (let i = 0; i < 4; i++) s.registrarFalhaLogin('a@x.com');
    s.limparLogin('a@x.com');
    s.registrarFalhaLogin('a@x.com');
    expect(s.minutosBloqueado('a@x.com')).toBe(0);
  });

  it('codigo 2FA esgota na 5a tentativa errada', () => {
    const s = new LoginAttemptsService();
    const r = [1, 2, 3, 4, 5].map(() => s.registrarFalhaCodigo('c1'));
    expect(r).toEqual([false, false, false, false, true]);
  });
});
