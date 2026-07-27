// Auditoria de seguranca (achado I1, 27/07/2026): TransferAtendimentoUseCase
// gravava novoOwnerId/novoFilaId sem validar que pertencem ao mesmo tenant
// de quem esta transferindo - permitia (em tese) transferir para um UUID de
// outro tenant, quebrando isolamento multitenant a nivel de dado. Unitario:
// o que importa aqui e o BRANCHING de validacao (bloqueia ou nao), nao
// persistencia real - mockando IUserRepository/IFilaRepository do mesmo
// jeito que AddUsuarioToFilaUseCase.spec.ts (se existisse) faria.
import { NotFoundException } from '@nestjs/common';
import { TransferAtendimentoUseCase } from './transfer-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';

function setup() {
  const atendimentoRepository = {
    findByIdAndTenant: jest.fn(),
    update: jest.fn(),
  };
  const eventoRepository = { create: jest.fn() };
  const filaRepository = { findByIdAndTenant: jest.fn() };
  const userRepository = { findById: jest.fn() };

  const useCase = new TransferAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
    filaRepository as unknown as IFilaRepository,
    userRepository as unknown as IUserRepository,
  );

  const atendimento = {
    id: 'atendimento-1',
    tenantId: 'tenant-1',
    status: 'aguardando',
    ownerId: null,
    filaId: null,
  };
  atendimentoRepository.findByIdAndTenant.mockResolvedValue(atendimento);
  atendimentoRepository.update.mockImplementation((id: string, data: unknown) => ({
    ...atendimento,
    ...(data as object),
  }));

  return { useCase, atendimentoRepository, eventoRepository, filaRepository, userRepository, atendimento };
}

describe('TransferAtendimentoUseCase - validacao de tenant no destino (achado I1)', () => {
  it('transferencia legitima para um AGENTE do MESMO tenant continua funcionando (sem regressao)', async () => {
    const { useCase, userRepository, atendimentoRepository } = setup();
    userRepository.findById.mockResolvedValue({ id: 'user-2', tenantId: 'tenant-1' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'admin-1',
      requesterRole: 'Administrador',
      novoOwnerId: 'user-2',
    });

    expect(userRepository.findById).toHaveBeenCalledWith('user-2');
    expect(atendimentoRepository.update).toHaveBeenCalledWith(
      'atendimento-1',
      expect.objectContaining({ ownerId: 'user-2', status: 'em_atendimento' }),
    );
    expect(result.ownerId).toBe('user-2');
  });

  it('transferencia legitima para uma FILA do MESMO tenant continua funcionando (sem regressao)', async () => {
    const { useCase, filaRepository, atendimentoRepository } = setup();
    filaRepository.findByIdAndTenant.mockResolvedValue({ id: 'fila-2', tenantId: 'tenant-1', nome: 'Financeiro' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      requesterId: 'admin-1',
      requesterRole: 'Administrador',
      novoFilaId: 'fila-2',
    });

    expect(filaRepository.findByIdAndTenant).toHaveBeenCalledWith('fila-2', 'tenant-1');
    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', expect.objectContaining({ filaId: 'fila-2' }));
    expect(result.filaId).toBe('fila-2');
  });

  it('BLOQUEIA transferencia para um AGENTE de OUTRO tenant (userRepository.findById retorna usuario com tenantId diferente)', async () => {
    const { useCase, userRepository, atendimentoRepository } = setup();
    userRepository.findById.mockResolvedValue({ id: 'user-outro-tenant', tenantId: 'tenant-2' });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'admin-1',
        requesterRole: 'Administrador',
        novoOwnerId: 'user-outro-tenant',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(atendimentoRepository.update).not.toHaveBeenCalled();
  });

  it('BLOQUEIA transferencia para um AGENTE inexistente (userRepository.findById retorna null)', async () => {
    const { useCase, userRepository, atendimentoRepository } = setup();
    userRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'admin-1',
        requesterRole: 'Administrador',
        novoOwnerId: 'uuid-que-nao-existe',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(atendimentoRepository.update).not.toHaveBeenCalled();
  });

  it('BLOQUEIA transferencia para uma FILA de OUTRO tenant (findByIdAndTenant, ja escopado por tenant, retorna null)', async () => {
    const { useCase, filaRepository, atendimentoRepository } = setup();
    filaRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        requesterId: 'admin-1',
        requesterRole: 'Administrador',
        novoFilaId: 'fila-de-outro-tenant',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(filaRepository.findByIdAndTenant).toHaveBeenCalledWith('fila-de-outro-tenant', 'tenant-1');
    expect(atendimentoRepository.update).not.toHaveBeenCalled();
  });
});
