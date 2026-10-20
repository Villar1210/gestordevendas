import { GeocodeCacheRegistro, IGeocodeCacheRepository } from '../../domain/repositories/geocode-cache-repository.interface';
import { GeocodingIndisponivelError } from '../../domain/ports/geocoding-provider.interface';
import { chaveCacheItbi, chaveCacheTexto, GeocodingComCacheProvider, VALIDADE_NAO_ACHOU_MS } from './geocoding-com-cache.provider';
import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';

class CacheFake implements IGeocodeCacheRepository {
  dados = new Map<string, GeocodeCacheRegistro>();
  async buscar(chave: string) {
    return this.dados.get(chave) ?? null;
  }
  async gravar(r: Omit<GeocodeCacheRegistro, 'criadoEm'>) {
    this.dados.set(r.chave, { ...r, criadoEm: new Date() });
  }
}

const ACHOU = { lat: -23.59, lng: -46.56, precisao: 'rua' as const, enderecoFormatado: 'Rua X, São Paulo, 03277-000, Brasil', cep: '03277000' };

function montar(resposta: unknown) {
  const cache = new CacheFake();
  const geocodificar = jest.fn(async () => {
    if (resposta instanceof Error) throw resposta;
    return resposta as typeof ACHOU | null;
  });
  const provedor = { nome: 'nominatim', geocodificar } as unknown as NominatimGeocodingProvider;
  return { cache, geocodificar, svc: new GeocodingComCacheProvider(provedor, cache) };
}

describe('GeocodingComCacheProvider', () => {
  it('1a vez consulta o provedor e grava; 2a vem do cache (sem nova consulta)', async () => {
    const { svc, geocodificar, cache } = montar(ACHOU);
    expect(await svc.geocodificarComFonte('Rua X, 10')).toEqual({ fonte: 'provedor', resultado: ACHOU });
    expect(await svc.geocodificarComFonte('rua x 10')).toEqual({ fonte: 'cache', resultado: { ...ACHOU, enderecoFormatado: '' } });
    expect(geocodificar).toHaveBeenCalledTimes(1);
    const [salvo] = [...cache.dados.values()];
    expect(salvo.chave).toBe(chaveCacheTexto('Rua X, 10'));
    expect(salvo.chave).toMatch(/^txt:[0-9a-f]{64}$/); // texto pesquisado nao fica em claro
    // B2: chave txt: guarda so lat, lng, precisao e CEP
    expect(salvo).toMatchObject({ lat: ACHOU.lat, lng: ACHOU.lng, precisao: 'rua', cep: '03277000', enderecoFormatado: null });
    expect(JSON.stringify(salvo)).not.toMatch(/Rua X/);
  });

  it('acerto de cache txt: devolve o CEP guardado e formatado vazio', async () => {
    const { svc } = montar(ACHOU);
    await svc.geocodificar('Rua X, 10');
    const r = await svc.geocodificarComFonte('Rua X, 10');
    expect(r).toEqual({ fonte: 'cache', resultado: { ...ACHOU, enderecoFormatado: '' } });
  });

  it('"nao achou" tambem vai para o cache e evita repetir', async () => {
    const { svc, geocodificar, cache } = montar(null);
    expect(await svc.geocodificar('Rua Inexistente 1')).toBeNull();
    expect(await svc.geocodificar('Rua Inexistente 1')).toBeNull();
    expect(geocodificar).toHaveBeenCalledTimes(1);
    expect([...cache.dados.values()][0]).toMatchObject({ lat: null, lng: null, precisao: null });
  });

  it('"nao achou" expira depois de 30 dias (consulta de novo)', async () => {
    const { svc, geocodificar } = montar(null);
    await svc.geocodificar('Rua Y 1');
    svc.agora = () => new Date(Date.now() + VALIDADE_NAO_ACHOU_MS + 1000);
    await svc.geocodificar('Rua Y 1');
    expect(geocodificar).toHaveBeenCalledTimes(2);
  });

  it('falha temporaria do provedor NAO vai para o cache', async () => {
    const { svc, cache } = montar(new GeocodingIndisponivelError('HTTP 503'));
    await expect(svc.geocodificar('Rua Z 1')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
    expect(cache.dados.size).toBe(0);
  });

  it('chave do ITBI explicita', async () => {
    const { svc, cache } = montar(ACHOU);
    await svc.geocodificar('rua x 10, Sao Paulo', { chaveCache: chaveCacheItbi('rua x|10|03277000') });
    expect(cache.dados.get('itbi:rua x|10|03277000')).toMatchObject({ enderecoFormatado: ACHOU.enderecoFormatado, cep: '03277000' });
  });
});
