// Achado I7 da auditoria: SendWhatsAppMessageUseCase so checava
// session.status (banco), que pode ficar STALE apos um restart do processo
// (socket em memoria some, mas o ultimo valor gravado continua "CONNECTED"
// ate o proximo evento 'open'/'close' do Baileys). Corrigido para exigir
// tambem IWhatsAppProvider.isConnected() (estado real do socket em
// memoria) antes de enviar.
import { SendWhatsAppMessageUseCase } from './send-whatsapp-message.use-case';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

function setup(sessionStatus: string, isConnectedReturn: boolean) {
  const sessionRepository = { findByIdAndTenant: jest.fn() };
  const whatsAppProvider = {
    isConnected: jest.fn(),
    sendMessage: jest.fn(),
  };

  const useCase = new SendWhatsAppMessageUseCase(
    sessionRepository as unknown as IWhatsAppSessionRepository,
    whatsAppProvider as unknown as IWhatsAppProvider,
  );

  sessionRepository.findByIdAndTenant.mockResolvedValue({
    id: 'session-1',
    tenantId: 'tenant-1',
    status: sessionStatus,
  });
  whatsAppProvider.isConnected.mockReturnValue(isConnectedReturn);
  whatsAppProvider.sendMessage.mockResolvedValue(undefined);

  return { useCase, sessionRepository, whatsAppProvider };
}

describe('SendWhatsAppMessageUseCase - checagem real do socket (I7)', () => {
  it('sessao CONNECTED no banco e isConnected()=true: envia normalmente', async () => {
    const { useCase, whatsAppProvider } = setup('CONNECTED', true);

    await useCase.execute({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      to: '5511999990000@s.whatsapp.net',
      body: 'Ola',
    });

    expect(whatsAppProvider.sendMessage).toHaveBeenCalledWith(
      'session-1',
      '5511999990000@s.whatsapp.net',
      'Ola',
      undefined,
    );
  });

  it('sessao CONNECTED no banco mas isConnected()=false (status stale apos restart): bloqueia sem enviar', async () => {
    const { useCase, whatsAppProvider } = setup('CONNECTED', false);

    await expect(
      useCase.execute({
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        to: '5511999990000@s.whatsapp.net',
        body: 'Ola',
      }),
    ).rejects.toThrow('Sessao WhatsApp nao esta conectada (socket real desconectado, apesar do status gravado).');

    expect(whatsAppProvider.sendMessage).not.toHaveBeenCalled();
  });

  it('sessao ja DISCONNECTED no banco: bloqueia antes mesmo de checar isConnected()', async () => {
    const { useCase, whatsAppProvider } = setup('DISCONNECTED', true);

    await expect(
      useCase.execute({
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        to: '5511999990000@s.whatsapp.net',
        body: 'Ola',
      }),
    ).rejects.toThrow('Sessao WhatsApp nao esta conectada.');

    expect(whatsAppProvider.isConnected).not.toHaveBeenCalled();
    expect(whatsAppProvider.sendMessage).not.toHaveBeenCalled();
  });

  it('sessao nao encontrada (tenant errado ou id invalido): NotFoundException', async () => {
    const sessionRepository = { findByIdAndTenant: jest.fn().mockResolvedValue(null) };
    const whatsAppProvider = { isConnected: jest.fn(), sendMessage: jest.fn() };
    const useCase = new SendWhatsAppMessageUseCase(
      sessionRepository as unknown as IWhatsAppSessionRepository,
      whatsAppProvider as unknown as IWhatsAppProvider,
    );

    await expect(
      useCase.execute({
        sessionId: 'session-inexistente',
        tenantId: 'tenant-1',
        to: '5511999990000@s.whatsapp.net',
        body: 'Ola',
      }),
    ).rejects.toThrow('Sessao WhatsApp nao encontrada.');
  });
});
