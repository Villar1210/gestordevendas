// Achado I14 da auditoria: AssignAtendimentoUseCase nao tinha nenhuma
// spec. Unitario: cobre o branching de autorizacao (Administrador
// ignora a checagem de fila; Corretor precisa pertencer a fila do
// atendimento), os guards de estado (nao encontrado/ja fechado), e os
// dados persistidos (update + evento de auditoria).
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AssignAtendimentoUseCase } from './assign-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const atendimentoRepository = {
    findByIdAndTenant: jest.fn(),
    update: jest.fn(),
  };
  const filaRepository = { isUsuarioInFila: jest.fn() };
  const eventoRepository = { create: jest.fn() };

  const useCase = new AssignAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    filaRepository as unknown as IFilaRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
  );

  atendimentoRepository.update.mockImplementation((id: string, data: unknown) => ({
    id,
    ...(data as object),
  }));
  eventoRepository.create.mockResolvedValue({ id: 'evento-1' });

  return { useCase, atendimentoRepository, filaRepository, eventoRepository };
}

describe('AssignAtendimentoUseCase', () => {
  it('lanca NotFoundException se o atendimento nao existir', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'inexistente',
        userId: 'user-1',
        userRole: 'Corretor',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca ConflictException se o atendimento ja estiver fechado', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ status: 'fechado' }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'user-1',
        userRole: 'Corretor',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('BLOQUEIA um Corretor se o atendimento ainda nao foi classificado numa fila (filaId null)', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ status: 'aguardando', filaId: null }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'user-1',
        userRole: 'Corretor',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(filaRepository.isUsuarioInFila).not.toHaveBeenCalled();
  });

  it('BLOQUEIA um Corretor que NAO pertence a fila do atendimento', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ status: 'aguardando', filaId: 'fila-1' }),
    );
    filaRepository.isUsuarioInFila.mockResolvedValue(false);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'user-1',
        userRole: 'Corretor',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(filaRepository.isUsuarioInFila).toHaveBeenCalledWith('fila-1', 'user-1');
  });

  it('PERMITE um Corretor que pertence a fila do atendimento assumir', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'aguardando', filaId: 'fila-1' }),
    );
    filaRepository.isUsuarioInFila.mockResolvedValue(true);

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'user-1',
      userRole: 'Corretor',
    });

    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', {
      ownerId: 'user-1',
      status: 'em_atendimento',
    });
  });

  it('PERMITE o Administrador assumir MESMO sem pertencer a nenhuma fila (bypass da checagem de fila)', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'aguardando', filaId: null }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'admin-1',
      userRole: 'Administrador',
    });

    expect(filaRepository.isUsuarioInFila).not.toHaveBeenCalled();
    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', {
      ownerId: 'admin-1',
      status: 'em_atendimento',
    });
  });

  it('registra o evento de auditoria "atribuido" com o userId de quem assumiu', async () => {
    const { useCase, atendimentoRepository, eventoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'aguardando', filaId: 'fila-1' }),
    );
    filaRepository.isUsuarioInFila.mockResolvedValue(true);

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'user-1',
      userRole: 'Corretor',
    });

    expect(eventoRepository.create).toHaveBeenCalledWith({
      atendimentoId: 'atendimento-1',
      tipo: 'atribuido',
      userId: 'user-1',
    });
  });

  it('retorna o atendimento atualizado', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(
      buildAtendimentoRecord({ id: 'atendimento-1', status: 'aguardando', filaId: 'fila-1' }),
    );
    filaRepository.isUsuarioInFila.mockResolvedValue(true);
    atendimentoRepository.update.mockResolvedValue({ id: 'atendimento-1', ownerId: 'user-1' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'user-1',
      userRole: 'Corretor',
    });

    expect(result).toEqual({ id: 'atendimento-1', ownerId: 'user-1' });
  });
});
