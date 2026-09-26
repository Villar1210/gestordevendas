import { BadRequestException } from '@nestjs/common';
import { UpdateTenantConfigUseCase } from './update-tenant-config.use-case';

describe('UpdateTenantConfigUseCase - site imobiliario', () => {
  const repo = { findByTenantId: jest.fn(), update: jest.fn().mockResolvedValue({}) };
  const useCase = new UpdateTenantConfigUseCase(repo as never);
  const base = { tenantId: 't1', requesterRole: 'Administrador' };

  beforeEach(() => repo.update.mockClear());

  it('normaliza slug e dominio', async () => {
    await useCase.execute({ ...base, siteSlug: 'Direcional', siteDominio: 'https://www.Imoveis.Direcional.com.br/' });
    expect(repo.update).toHaveBeenCalledWith('t1', expect.objectContaining({ slug: 'direcional', dominio: 'imoveis.direcional.com.br' }));
  });

  it('aceita subdominio de ivillar.com.br para site de empresa', async () => {
    await useCase.execute({ ...base, siteDominio: 'direcional.ivillar.com.br' });
    expect(repo.update).toHaveBeenCalledWith('t1', expect.objectContaining({ dominio: 'direcional.ivillar.com.br' }));
  });

  it('string vazia remove slug e dominio', async () => {
    await useCase.execute({ ...base, siteSlug: '', siteDominio: '  ' });
    expect(repo.update).toHaveBeenCalledWith('t1', expect.objectContaining({ slug: null, dominio: null }));
  });

  it('sem os campos, nao mexe em slug/dominio', async () => {
    await useCase.execute({ ...base, name: 'X' });
    const input = repo.update.mock.calls[0][1];
    expect(input.slug).toBeUndefined();
    expect(input.dominio).toBeUndefined();
  });

  it.each(['-direcional', 'a', 'dire--'])('rejeita slug invalido %s', async (slug) => {
    await expect(useCase.execute({ ...base, siteSlug: slug })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['localhost', 'nao tem ponto', 'gestordevendas.ivillar.com.br', 'ivillar.com.br', 'chatwoot.ivillar.com.br'])(
    'rejeita dominio %s',
    async (dominio) => {
      await expect(useCase.execute({ ...base, siteDominio: dominio })).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
