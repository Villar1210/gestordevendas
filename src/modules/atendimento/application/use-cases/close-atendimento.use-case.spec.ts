// Cobre a nova emissao de 'atendimento.fechado' (ver
// ReabrirViviAposFechamentoUseCase, modulo vivi_sdr, que escuta este
// evento) - alem do comportamento pre-existente de fechamento em si.
import { CloseAtendimentoUseCase } from './close-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const atendimentoRepository = {
    findByIdAndTenant: jest.fn(),
    update: jest.fn(),
  };
  const eventoRepository = { create: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new CloseAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
    eventEmitter as any,
  );

  return { useCase, atendimentoRepository, eventoRepository, eventEmitter };
}

describe('CloseAtendimentoUseCase', () => {
  it('ao fechar com sucesso, emite "atendimento.fechado" com tenantId/sessao/remoteJid/phoneNumber do atendimento', async () => {
    const { useCase, atendimentoRepository, eventoRepository, eventEmitter } = setup();
    const atendimento = buildAtendimentoRecord({
      id: 'atendimento-1',
      tenantId: 'tenant-1',
      whatsappSessionId: 'session-1',
      remoteJid: '5511999990000@s.whatsapp.net',
      phoneNumber: '5511999990000',
      status: 'em_atendimento',
      ownerId: 'user-1',
    });
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(atendimento);
    atendimentoRepository.update.mockResolvedValue({ ...atendimento, status: 'fechado' });
    eventoRepository.create.mockResolvedValue({});

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'user-1',
      requesterRole: 'Corretor',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith('atendimento.fechado', {
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      whatsappSessionId: 'session-1',
      remoteJid: '5511999990000@s.whatsapp.net',
      phoneNumber: '5511999990000',
    });
  });

  it('atendimento ja fechado: lanca erro e NAO emite o evento de novo', async () => {
    const { useCase, atendimentoRepository, eventEmitter } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'fechado' }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'user-1',
        requesterRole: 'Administrador',
      }),
    ).rejects.toThrow();

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
