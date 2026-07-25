// Confirma que o segundo chamador real de SendWhatsAppMessageUseCase (alem
// da VIVI) tambem passa "phoneNumber" - fecha o bug do toNumber/@lid
// tambem para respostas manuais de agentes humanos via Central de
// Atendimento, nao so para a VIVI.
import { EnviarMensagemAtendimentoUseCase } from './enviar-mensagem-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

describe('EnviarMensagemAtendimentoUseCase', () => {
  it('passa phoneNumber (nao so o remoteJid) para SendWhatsAppMessageUseCase, preservando o toNumber correto em contatos @lid', async () => {
    const atendimentoRepository = { findByIdAndTenant: jest.fn() };
    const sendWhatsAppMessageUseCase = { execute: jest.fn() };

    const useCase = new EnviarMensagemAtendimentoUseCase(
      atendimentoRepository as unknown as IAtendimentoRepository,
      sendWhatsAppMessageUseCase as unknown as SendWhatsAppMessageUseCase,
    );

    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({
        id: 'atendimento-1',
        whatsappSessionId: 'session-1',
        remoteJid: '99961119199259@lid',
        phoneNumber: '5511966111111',
      }),
    );
    sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);

    await useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'atendimento-1', body: 'Oi, tudo bem?' });

    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      to: '99961119199259@lid',
      phoneNumber: '5511966111111',
      body: 'Oi, tudo bem?',
    });
  });
});
