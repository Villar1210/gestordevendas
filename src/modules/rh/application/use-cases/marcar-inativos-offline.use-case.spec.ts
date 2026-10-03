import { MarcarInativosOfflineUseCase } from './marcar-inativos-offline.use-case';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

describe('MarcarInativosOfflineUseCase', () => {
  it('devolve quantos usuarios foram derrubados para offline', async () => {
    const repo = {
      marcarOfflinePorInatividade: jest.fn().mockResolvedValue([
        { id: 'u1', tenantId: 't1', name: 'Ana' },
        { id: 'u2', tenantId: 't1', name: 'Bruno' },
      ]),
    } as unknown as ICorretorRepository;
    const useCase = new MarcarInativosOfflineUseCase(repo);
    await expect(useCase.execute()).resolves.toBe(2);
  });

  it('nao faz nada quando ninguem esta inativo', async () => {
    const repo = { marcarOfflinePorInatividade: jest.fn().mockResolvedValue([]) } as unknown as ICorretorRepository;
    await expect(new MarcarInativosOfflineUseCase(repo).execute()).resolves.toBe(0);
  });
});
