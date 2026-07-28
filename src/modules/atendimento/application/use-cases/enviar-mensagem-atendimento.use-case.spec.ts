// Confirma que o segundo chamador real de SendWhatsAppMessageUseCase (alem
// da VIVI) tambem passa "phoneNumber" - fecha o bug do toNumber/@lid
// tambem para respostas manuais de agentes humanos via Central de
// Atendimento, nao so para a VIVI.
//
// Auditoria de seguranca (achado I2, 28/07/2026): o use case nao checava
// escopo antes de enviar a mensagem - qualquer usuario do tenant conseguia
// enviar em qualquer atendimento, mesmo sem ser dono nem Administrador.
// Mesmo padrao de checagem ja usado em
// CloseAtendimentoUseCase/TransferAtendimentoUseCase/RequeueAtendimentoUseCase
// (isOwner OU Administrador) - por isso o use case passou a exigir
// requesterId/requesterRole, e o teste original abaixo foi atualizado para
// passar esses campos (dono do atendimento) sem mudar o que ja testava.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
        ownerId: 'dono-1',
      }),
    );
    sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
      body: 'Oi, tudo bem?',
    });

    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      to: '99961119199259@lid',
      phoneNumber: '5511966111111',
      body: 'Oi, tudo bem?',
    });
  });
});

describe('EnviarMensagemAtendimentoUseCase - checagem de escopo (achado I2)', () => {
  function setup() {
    const atendimentoRepository = { findByIdAndTenant: jest.fn() };
    const sendWhatsAppMessageUseCase = { execute: jest.fn() };

    const useCase = new EnviarMensagemAtendimentoUseCase(
      atendimentoRepository as unknown as IAtendimentoRepository,
      sendWhatsAppMessageUseCase as unknown as SendWhatsAppMessageUseCase,
    );

    const atendimento = buildAtendimentoRecord({
      id: 'atendimento-1',
      whatsappSessionId: 'session-1',
      remoteJid: '5511999990000@s.whatsapp.net',
      phoneNumber: '5511999990000',
      ownerId: 'dono-1',
    });
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(atendimento);
    sendWhatsAppMessageUseCase.execute.mockResolvedValue(undefined);

    return { useCase, atendimentoRepository, sendWhatsAppMessageUseCase };
  }

  it('o DONO do atendimento consegue enviar a mensagem', async () => {
    const { useCase, sendWhatsAppMessageUseCase } = setup();

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
      body: 'Oi, tudo bem?',
    });

    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalled();
  });

  it('o Administrador consegue enviar a mensagem MESMO NAO sendo o dono', async () => {
    const { useCase, sendWhatsAppMessageUseCase } = setup();

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'admin-1',
      requesterRole: 'Administrador',
      body: 'Mensagem do administrador.',
    });

    expect(sendWhatsAppMessageUseCase.execute).toHaveBeenCalled();
  });

  it('BLOQUEIA um usuario que NAO e dono nem Administrador', async () => {
    const { useCase, sendWhatsAppMessageUseCase } = setup();

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'outro-corretor',
        requesterRole: 'Corretor',
        body: 'Tentativa indevida.',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(sendWhatsAppMessageUseCase.execute).not.toHaveBeenCalled();
  });

  it('continua lancando NotFoundException se o atendimento nao existir (sem regressao)', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'inexistente',
        requesterId: 'dono-1',
        requesterRole: 'Corretor',
        body: 'Mensagem.',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
