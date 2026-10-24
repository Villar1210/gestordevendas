import { GEOSAMPA_MAX_BYTES, GeoSampaWfsClient, lerTotalHits, montarUrlGeoSampa } from './geosampa-wfs.client';
import { GeoSampaIndisponivelError } from '../../domain/ports/geosampa-wfs.interface';

const resp = (corpo: string, status = 200, headers: Record<string, string> = {}) => new Response(corpo, { status, headers });

describe('montarUrlGeoSampa', () => {
  it('host fixo, WGS84, ordenado, paginado e so os campos usados', () => {
    const u = new URL(montarUrlGeoSampa('lote_cidadao', { inicio: 20000, quantidade: 10000 }));
    expect(u.origin + u.pathname).toBe('https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs');
    expect(u.searchParams.get('typeNames')).toBe('geoportal:lote_cidadao');
    expect(u.searchParams.get('srsName')).toBe('EPSG:4326');
    expect(u.searchParams.get('sortBy')).toBe('cd_identificador');
    expect(u.searchParams.get('startIndex')).toBe('20000');
    expect(u.searchParams.get('count')).toBe('10000');
    expect(u.searchParams.get('propertyName')).toContain('cd_condominio');
    expect(u.searchParams.get('outputFormat')).toBe('application/json');
  });

  it('count limitado a 30 mil; hits sem paginacao', () => {
    expect(new URL(montarUrlGeoSampa('quadra_fiscal', { inicio: -5, quantidade: 99999 })).searchParams.get('count')).toBe('30000');
    const h = new URL(montarUrlGeoSampa('quadra_fiscal', { hits: true }));
    expect(h.searchParams.get('resultType')).toBe('hits');
    expect(h.searchParams.get('startIndex')).toBeNull();
  });

  it('le o total do XML de hits', () => {
    expect(lerTotalHits('<wfs:FeatureCollection numberMatched="64229" numberReturned="0"/>')).toBe(64229);
    expect(lerTotalHits('<x/>')).toBeNull();
  });
});

describe('GeoSampaWfsClient', () => {
  it('pagina: devolve as features; sem redirect', async () => {
    const fetch = jest.fn(async () => resp(JSON.stringify({ features: [{ properties: { a: 1 } }] })));
    const c = new GeoSampaWfsClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.pagina('quadra_fiscal', 0, 10)).resolves.toEqual([{ properties: { a: 1 } }]);
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: 'error' });
  });

  it('400 com propertyName: tenta uma vez sem filtro de campos', async () => {
    const urls: string[] = [];
    const fetch = jest.fn(async (url: string) => {
      urls.push(url);
      return url.includes('propertyName') ? resp('bad', 400) : resp(JSON.stringify({ features: [] }));
    });
    const c = new GeoSampaWfsClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.pagina('lote_cidadao', 0, 10)).resolves.toEqual([]);
    expect(urls[1]).not.toContain('propertyName');
    // as proximas paginas ja vao sem o filtro
    await c.pagina('lote_cidadao', 10, 10);
    expect(urls[2]).not.toContain('propertyName');
  });

  it('erro HTTP, JSON invalido, resposta enorme e rede caindo viram GeoSampaIndisponivelError', async () => {
    const casos = [
      async () => resp('x', 503),
      async () => resp('nao e json'),
      async () => resp('{}'),
      async () => resp('{}', 200, { 'content-length': String(GEOSAMPA_MAX_BYTES + 1) }),
      async () => {
        throw new TypeError('fetch failed');
      },
    ];
    for (const f of casos) {
      const c = new GeoSampaWfsClient({ fetch: jest.fn(f) as unknown as typeof globalThis.fetch });
      await expect(c.pagina('quadra_fiscal', 0, 10)).rejects.toBeInstanceOf(GeoSampaIndisponivelError);
    }
  });

  it('contar: le numberMatched', async () => {
    const c = new GeoSampaWfsClient({
      fetch: jest.fn(async () => resp('<wfs:FeatureCollection numberMatched="1687982"/>')) as unknown as typeof globalThis.fetch,
    });
    await expect(c.contar('lote_cidadao')).resolves.toBe(1687982);
  });
});
