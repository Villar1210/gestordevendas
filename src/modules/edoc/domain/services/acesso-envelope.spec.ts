// Fase A (27/10/2026): nao-Administrador so ve os envelopes que criou.
import { filtroCriadorEnvelope, podeVerEnvelope } from './acesso-envelope';
import { ListEnvelopesUseCase } from '../../application/use-cases/list-envelopes.use-case';
import { GetEnvelopeDetailUseCase } from '../../application/use-cases/get-envelope-detail.use-case';
import { ISignatureEnvelopeRepository } from '../repositories/signature-envelope-repository.interface';

describe('acesso a envelopes do E-doc', () => {
  it('Administrador ve todos; corretor so os proprios', () => {
    expect(filtroCriadorEnvelope('Administrador', 'u-admin')).toBeNull();
    expect(filtroCriadorEnvelope('Corretor', 'u-1')).toBe('u-1');
    expect(podeVerEnvelope('Corretor', 'u-1', 'u-1')).toBe(true);
    expect(podeVerEnvelope('Corretor', 'u-1', 'u-2')).toBe(false);
    expect(podeVerEnvelope('Administrador', 'u-admin', 'u-2')).toBe(true);
  });

  it('a lista do corretor e filtrada pelo criador', async () => {
    const repo = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    const useCase = new ListEnvelopesUseCase(repo as unknown as ISignatureEnvelopeRepository);
    await useCase.execute({ tenantId: 't-1', requesterRole: 'Corretor', requesterUserId: 'u-1' });
    expect(repo.findAllByTenant).toHaveBeenCalledWith('t-1', expect.objectContaining({ createdByUserId: 'u-1' }));

    await useCase.execute({ tenantId: 't-1', requesterRole: 'Administrador', requesterUserId: 'u-admin' });
    expect(repo.findAllByTenant).toHaveBeenLastCalledWith('t-1', expect.objectContaining({ createdByUserId: undefined }));
  });

  it('abrir o envelope de outro usuario responde 404', async () => {
    const repo = { findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'e-1', createdByUserId: 'u-2' }) };
    const useCase = new GetEnvelopeDetailUseCase(repo as never, {} as never);
    await expect(
      useCase.execute({ envelopeId: 'e-1', tenantId: 't-1', requesterRole: 'Corretor', requesterUserId: 'u-1' }),
    ).rejects.toThrow('Envelope nao encontrado.');
  });
});
