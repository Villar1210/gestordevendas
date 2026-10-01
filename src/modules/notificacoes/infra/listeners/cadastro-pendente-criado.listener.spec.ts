import { CadastroPendenteCriadoListener } from './cadastro-pendente-criado.listener';

describe('CadastroPendenteCriadoListener', () => {
  const OLD_ENV = process.env.FRONTEND_URL;
  beforeEach(() => { process.env.FRONTEND_URL = 'https://gestor.exemplo/'; });
  afterAll(() => { process.env.FRONTEND_URL = OLD_ENV; });

  function montar(opts: { emailFalha?: boolean } = {}) {
    const userRepository = {
      findAllByTenantAndRole: jest.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]),
      findById: jest.fn(async (id: string) => ({ id, name: `Admin ${id}`, email: `${id}@ex.com` })),
    };
    const createNotificationUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    const emailSender = {
      send: jest.fn(async (input: { to: string }) => {
        if (opts.emailFalha && input.to === 'a1@ex.com') throw new Error('smtp fora');
      }),
    };
    const listener = new CadastroPendenteCriadoListener(
      userRepository as never,
      createNotificationUseCase as never,
      emailSender as never,
    );
    return { listener, userRepository, createNotificationUseCase, emailSender };
  }

  it('notifica e envia e-mail com link direto ao cadastro', async () => {
    const { listener, createNotificationUseCase, emailSender } = montar();
    await listener.handle({ tenantId: 't1', cadastroId: 'c-9', nome: 'Maria <b>', roleName: 'Corretor' });

    expect(createNotificationUseCase.execute).toHaveBeenCalledTimes(2);
    expect(createNotificationUseCase.execute.mock.calls[0][0].link).toBe('/dashboard/rh/aprovacoes?cadastro=c-9');
    expect(emailSender.send).toHaveBeenCalledTimes(2);
    const email = emailSender.send.mock.calls[0][0] as { to: string; subject: string; body: string };
    expect(email.to).toBe('a1@ex.com');
    expect(email.body).toContain('href="https://gestor.exemplo/dashboard/rh/aprovacoes?cadastro=c-9"');
    expect(email.body).toContain('Maria &lt;b&gt;');
    expect(email.body).not.toContain('Maria <b>');
  });

  it('sem cadastroId cai na lista geral', async () => {
    const { listener, createNotificationUseCase } = montar();
    await listener.handle({ tenantId: 't1', nome: 'X', roleName: 'Cliente' });
    expect(createNotificationUseCase.execute.mock.calls[0][0].link).toBe('/dashboard/rh/aprovacoes');
  });

  it('falha de um e-mail nao impede os outros nem lanca erro', async () => {
    const { listener, emailSender } = montar({ emailFalha: true });
    await expect(
      listener.handle({ tenantId: 't1', cadastroId: 'c1', nome: 'X', roleName: 'Corretor' }),
    ).resolves.toBeUndefined();
    expect(emailSender.send).toHaveBeenCalledTimes(2);
  });
});
