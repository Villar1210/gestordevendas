import { COBERTURA_CACHE_MS, CoberturaItbiCache } from './cobertura-itbi.cache';
import { GetItbiCoberturaUseCase } from '../use-cases/itbi-cobertura.use-case';
import { IItbiRepository } from '../../domain/repositories/itbi-repository.interface';
import { IItbiImportacaoRepository } from '../../domain/repositories/itbi-importacao-repository.interface';

describe('QA-4: cache de 10 min do GET /bii/itbi/cobertura', () => {
  function montar() {
    const cobertura = jest.fn(async () => ({ totalTransacoes: 10, geocodificadas: 2, atualizadoAte: null }));
    const itbi = { cobertura } as unknown as IItbiRepository;
    const imp = { anosConcluidos: async () => [2026], ultimaConcluida: async () => new Date('2026-10-20T10:00:00Z') } as unknown as IItbiImportacaoRepository;
    const cache = new CoberturaItbiCache();
    let agora = 1_000_000;
    cache.agora = () => agora;
    return { uc: new GetItbiCoberturaUseCase(itbi, imp, cache), cache, cobertura, avancar: (ms: number) => (agora += ms) };
  }

  it('2a chamada dentro de 10 min nao consulta o banco; depois de 10 min consulta de novo', async () => {
    const { uc, cobertura, avancar } = montar();
    const r = await uc.execute({ requesterRole: 'Administrador' });
    expect(r).toEqual({ anos: [2026], totalTransacoes: 10, geocodificadas: 2, ultimaImportacao: '2026-10-20T10:00:00.000Z' });
    await uc.execute({ requesterRole: 'Administrador' });
    expect(cobertura).toHaveBeenCalledTimes(1);
    avancar(COBERTURA_CACHE_MS + 1);
    await uc.execute({ requesterRole: 'Administrador' });
    expect(cobertura).toHaveBeenCalledTimes(2);
  });

  it('invalidar() (importacao/geocodificacao concluida) forca recalcular', async () => {
    const { uc, cache, cobertura } = montar();
    await uc.execute({ requesterRole: 'Administrador' });
    cache.invalidar();
    await uc.execute({ requesterRole: 'Administrador' });
    expect(cobertura).toHaveBeenCalledTimes(2);
  });

  it('cache nao fura a checagem de role', async () => {
    const { uc } = montar();
    await uc.execute({ requesterRole: 'Administrador' });
    await expect(uc.execute({ requesterRole: 'Corretor' })).rejects.toThrow();
  });
});
