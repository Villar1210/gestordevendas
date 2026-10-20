import { GeocodingIndisponivelError } from '../../domain/ports/geocoding-provider.interface';
import { FilaTaxa } from './fila-taxa';
import {
  interpretarResposta,
  montarUserAgent,
  NominatimGeocodingProvider,
  precisaoNominatim,
  resolverBaseUrl,
} from './nominatim-geocoding.provider';

const ITEM_CASA = {
  lat: '-23.5935',
  lon: '-46.5628',
  category: 'place',
  type: 'house',
  addresstype: 'place',
  place_rank: 30,
  display_name: '100, Rua Ibitirama, Vila Prudente, São Paulo, Região Imediata de São Paulo, São Paulo, 03134-000, Brasil',
};

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function provedor(fetchMock: jest.Mock, extra: Record<string, unknown> = {}) {
  return new NominatimGeocodingProvider({
    fetch: fetchMock as unknown as typeof fetch,
    fila: new FilaTaxa(0),
    baseUrl: undefined,
    contato: 'contato@exemplo.com.br',
    ...extra,
  });
}

describe('NominatimGeocodingProvider (fetch mockado - sem rede)', () => {
  it('URL: host fixo, jsonv2, limit 1, countrycodes br, addressdetails 0, viewbox SP, bounded 0, q codificado', async () => {
    const f = jest.fn(async () => respostaJson([ITEM_CASA]));
    await provedor(f).geocodificar('Rua Ibitirama, 100 & x=1, São Paulo');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin).toBe('https://nominatim.openstreetmap.org');
    expect(u.pathname).toBe('/search');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'br',
      addressdetails: '0',
      viewbox: '-46.83,-23.35,-46.36,-24.01',
      bounded: '0',
      q: 'Rua Ibitirama, 100 & x=1, São Paulo',
    });
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('gestordevendas-bii/1.0 (contato: contato@exemplo.com.br)');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('resultado: lat/lng, precisao rooftop, endereco formatado e CEP do display_name', async () => {
    const r = await provedor(jest.fn(async () => respostaJson([ITEM_CASA]))).geocodificar('x');
    expect(r).toEqual({
      lat: -23.5935,
      lng: -46.5628,
      precisao: 'rooftop',
      enderecoFormatado: ITEM_CASA.display_name,
      cep: '03134000',
    });
  });

  it('nao achou (lista vazia) -> null', async () => {
    expect(await provedor(jest.fn(async () => respostaJson([]))).geocodificar('x')).toBeNull();
  });

  it('resultado so de cidade -> null (pino no centro da cidade enganaria)', async () => {
    const cidade = { ...ITEM_CASA, category: 'boundary', type: 'administrative', addresstype: 'city', place_rank: 16 };
    expect(await provedor(jest.fn(async () => respostaJson([cidade]))).geocodificar('x')).toBeNull();
  });

  it('HTTP 429/500 e JSON invalido -> GeocodingIndisponivelError', async () => {
    await expect(provedor(jest.fn(async () => respostaJson({}, 429))).geocodificar('x')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
    await expect(provedor(jest.fn(async () => respostaJson({}, 500))).geocodificar('x')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
    await expect(provedor(jest.fn(async () => new Response('<html>'))).geocodificar('x')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
  });

  it('falha de rede -> GeocodingIndisponivelError', async () => {
    const f = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(provedor(f).geocodificar('x')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
  });

  it('timeout: aborta a requisicao lenta e vira GeocodingIndisponivelError', async () => {
    const f = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal!.addEventListener('abort', () => rej((init.signal as AbortSignal).reason));
        }),
    );
    const t0 = Date.now();
    await expect(provedor(f, { timeoutMs: 50 }).geocodificar('x')).rejects.toMatchObject({ message: expect.stringContaining('timeout') });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('resposta maior que 2 MB -> recusada', async () => {
    const grande = new Response('[' + ' '.repeat(2 * 1024 * 1024 + 10) + ']');
    await expect(provedor(jest.fn(async () => grande)).geocodificar('x')).rejects.toBeInstanceOf(GeocodingIndisponivelError);
  });

  it('usa a fila global (nao chama o fetch fora da fila)', async () => {
    const fila = new FilaTaxa(0);
    const agendar = jest.spyOn(fila, 'agendar');
    await provedor(jest.fn(async () => respostaJson([])), { fila }).geocodificar('x');
    expect(agendar).toHaveBeenCalledTimes(1);
  });
});

describe('Nominatim - configuracao e interpretacao', () => {
  it('resolverBaseUrl: so https (http so localhost); invalida -> padrao', () => {
    expect(resolverBaseUrl(undefined)).toBe('https://nominatim.openstreetmap.org');
    expect(resolverBaseUrl('https://geo.exemplo.com.br/nominatim/')).toBe('https://geo.exemplo.com.br/nominatim');
    expect(resolverBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
    expect(resolverBaseUrl('http://geo.exemplo.com')).toBe('https://nominatim.openstreetmap.org');
    expect(resolverBaseUrl('https://u:p@geo.exemplo.com')).toBe('https://nominatim.openstreetmap.org');
    expect(resolverBaseUrl('file:///etc/passwd')).toBe('https://nominatim.openstreetmap.org');
    expect(resolverBaseUrl('nao e url')).toBe('https://nominatim.openstreetmap.org');
  });

  it('User-Agent sem contato e sem caracteres de quebra (anti header injection)', () => {
    expect(montarUserAgent(undefined)).toBe('gestordevendas-bii/1.0');
    expect(montarUserAgent('a@b.com\r\nX-Evil: 1')).toBe('gestordevendas-bii/1.0 (contato: a@b.comX-Evil1)');
  });

  it.each([
    [{ addresstype: 'road', category: 'highway', type: 'residential', place_rank: 26 }, 'rua'],
    [{ addresstype: 'postcode', type: 'postcode', place_rank: 21 }, 'cep'],
    [{ addresstype: 'suburb', category: 'place', type: 'suburb', place_rank: 19 }, 'bairro'],
    [{ addresstype: 'building', category: 'building', type: 'yes', place_rank: 30 }, 'rooftop'],
    [{ addresstype: 'state', place_rank: 8 }, null],
  ])('precisao %p -> %p', (item, esperado) => {
    expect(precisaoNominatim(item)).toBe(esperado);
  });

  it('interpretarResposta: formato inesperado -> null', () => {
    expect(interpretarResposta({})).toBeNull();
    expect(interpretarResposta([{ lat: 'x', lon: '1' }])).toBeNull();
  });
});
