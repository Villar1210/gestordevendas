import { NotFoundException } from '@nestjs/common';
import { RegistrarAtividadeUseCase } from './registrar-atividade.use-case';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

describe('RegistrarAtividadeUseCase', () => {
  it('renova a atividade e devolve o status atual', async () => {
    const repo = { registrarAtividade: jest.fn().mockResolvedValue('offline') } as unknown as ICorretorRepository;
    const result = await new RegistrarAtividadeUseCase(repo).execute({ userId: 'u1', tenantId: 't1' });
    expect(repo.registrarAtividade).toHaveBeenCalledWith('u1', 't1');
    expect(result).toEqual({ statusDisponibilidade: 'offline' });
  });

  it('lanca NotFound quando o usuario nao existe no tenant', async () => {
    const repo = { registrarAtividade: jest.fn().mockResolvedValue(null) } as unknown as ICorretorRepository;
    await expect(new RegistrarAtividadeUseCase(repo).execute({ userId: 'x', tenantId: 't1' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
