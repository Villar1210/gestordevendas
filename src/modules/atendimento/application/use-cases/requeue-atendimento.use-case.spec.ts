// Achado I14 da auditoria: RequeueAtendimentoUseCase nao tinha nenhuma
// spec. Unitario: cobre os guards de estado/autorizacao (nao encontrado,
// ja fechado, so dono ou Administrador) e confirma explicitamente o
// reset de escalonamentoNotificadoEm (achado I6 - sem isso, um
// atendimento ja escalonado uma vez ficava invisivel para
// EscalonarAtendimentosSemDonoUseCase mesmo devolvido e ficando sem
// dono de novo depois).
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RequeueAtendimentoUseCase } from './requeue-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const atendimentoRepository = {
    findByIdAndTenant: jest.fn(),
    update: jest.fn(),
  };
  const eventoRepository = { create: jest.fn() };

  const useCase = new RequeueAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
  );

  atendimentoRepository.update.mockImplementation((id: string, data: unknown) => ({
    id,
    ...(data as object),
  }));
  eventoRepository.create.mockResolvedValue({ id: 'evento-1' });

  return { useCase, atendimentoRepository, eventoRepository };
}

describe('RequeueAtendimentoUseCase', () => {
  it('lanca NotFoundException se o atendimento nao existir', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'inexistente',
        requesterId: 'user-1',
        requesterRole: 'Corretor',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca ConflictException se o atendimento ja estiver fechado', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ status: 'fechado', ownerId: 'user-1' }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'user-1',
        requesterRole: 'Corretor',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('BLOQUEIA um usuario que NAO e o dono nem Administrador', async () => {
    const { useCase, atendimentoRepository, eventoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ status: 'em_atendimento', ownerId: 'dono-1' }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'outro-corretor',
        requesterRole: 'Corretor',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(eventoRepository.create).not.toHaveBeenCalled();
  });

  it('o DONO consegue devolver o atendimento para a fila', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'em_atendimento', ownerId: 'dono-1' }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
    });

    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', {
      ownerId: null,
      status: 'aguardando',
      escalonamentoNotificadoEm: null,
    });
  });

  it('o Administrador consegue devolver MESMO NAO sendo o dono', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'em_atendimento', ownerId: 'dono-1' }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'admin-1',
      requesterRole: 'Administrador',
    });

    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', {
      ownerId: null,
      status: 'aguardando',
      escalonamentoNotificadoEm: null,
    });
  });

  it('reseta escalonamentoNotificadoEm para null MESMO se o atendimento ja tinha sido escalonado antes (achado I6)', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({
        id: 'atendimento-1',
        status: 'em_atendimento',
        ownerId: 'dono-1',
        escalonamentoNotificadoEm: new Date('2026-01-01'),
      }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
    });

    expect(atendimentoRepository.update).toHaveBeenCalledWith(
      'atendimento-1',
      expect.objectContaining({ escalonamentoNotificadoEm: null }),
    );
  });

  it('registra o evento de auditoria "devolvido" com o userId de quem devolveu', async () => {
    const { useCase, atendimentoRepository, eventoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'em_atendimento', ownerId: 'dono-1' }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
    });

    expect(eventoRepository.create).toHaveBeenCalledWith({
      atendimentoId: 'atendimento-1',
      tipo: 'devolvido',
      userId: 'dono-1',
    });
  });

  it('retorna o atendimento atualizado', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'em_atendimento', ownerId: 'dono-1' }),
    );
    atendimentoRepository.update.mockResolvedValue({ id: 'atendimento-1', status: 'aguardando' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'dono-1',
      requesterRole: 'Corretor',
    });

    expect(result).toEqual({ id: 'atendimento-1', status: 'aguardando' });
  });
});
