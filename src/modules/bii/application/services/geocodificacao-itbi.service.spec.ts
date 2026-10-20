import { ConflictException, Logger } from '@nestjs/common';
import { GeocodingIndisponivelError, IGeocodingComCache, ResultadoComFonte } from '../../domain/ports/geocoding-provider.interface';
import { IItbiRepository } from '../../domain/repositories/itbi-repository.interface';
import { GeocodificacaoItbiService } from './geocodificacao-itbi.service';

const PONTO = { lat: -23.59, lng: -46.56, precisao: 'rooftop' as const, enderecoFormatado: 'x', cep: null };

function montar(chaves: string[], resposta: (consulta: string, signal?: AbortSignal) => Promise<ResultadoComFonte>) {
  const aplicadas: [string, { precisao: string }][] = [];
  const repo = {
    listarChavesSemPonto: jest.fn(async () => chaves),
    aplicarCoordenadas: jest.fn(async (chave: string, p: { precisao: string }) => {
      aplicadas.push([chave, p]);
      return 2;
    }),
  } as unknown as IItbiRepository;
  const geo: IGeocodingComCache = {
    nome: 'fake',
    geocodificar: async () => null,
    geocodificarComFonte: jest.fn((c: string, o?: { signal?: AbortSignal }) => resposta(c, o?.signal)),
  };
  return { svc: new GeocodificacaoItbiService(repo, geo), aplicadas, geo };
}

describe('GeocodificacaoItbiService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it('contabiliza cache x provedor, nao achou, fora da Grande SP; sem numero -> precisao no maximo "rua"', async () => {
    const { svc, aplicadas } = montar(['rua a|10|03277000', 'rua b||03277000', 'rua c|1|', 'rua d|2|'], async (c) => {
      if (c.startsWith('rua a')) return { fonte: 'cache', resultado: PONTO };
      if (c.startsWith('rua b')) return { fonte: 'provedor', resultado: PONTO };
      if (c.startsWith('rua c')) return { fonte: 'provedor', resultado: null };
      return { fonte: 'provedor', resultado: { ...PONTO, lat: -22.9, lng: -43.2 } }; // Rio
    });
    await svc.iniciar({ ceps: ['03277'], bairros: [], max: 10 });
    await svc.aguardar();
    expect(svc.status()).toMatchObject({ status: 'concluida', enfileirados: 4, processados: 4, encontrados: 2, naoEncontrados: 2, doCache: 1, consultasProvedor: 3, transacoesAtualizadas: 4 });
    expect(aplicadas).toEqual([
      ['rua a|10|03277000', { lat: PONTO.lat, lng: PONTO.lng, precisao: 'rooftop' }],
      ['rua b||03277000', { lat: PONTO.lat, lng: PONTO.lng, precisao: 'rua' }],
    ]);
  });

  it('provedor fora do ar 5 vezes seguidas -> encerra com erro', async () => {
    const { svc, geo } = montar(['a|1|', 'b|1|', 'c|1|', 'd|1|', 'e|1|', 'f|1|', 'g|1|'], async () => {
      throw new GeocodingIndisponivelError('HTTP 503');
    });
    await svc.iniciar({ ceps: ['03277'], bairros: [], max: 10 });
    await svc.aguardar();
    expect(svc.status()).toMatchObject({ status: 'erro', falhas: 5, processados: 5 });
    expect(geo.geocodificarComFonte).toHaveBeenCalledTimes(5);
  });

  it('um job por vez (409) e desligamento cancela sem travar', async () => {
    const { svc } = montar(['a|1|', 'b|1|'], (_c, signal) =>
      new Promise((_res, rej) => {
        if (signal?.aborted) return rej(signal.reason);
        signal?.addEventListener('abort', () => rej(signal.reason));
      }),
    );
    await svc.iniciar({ ceps: ['03277'], bairros: [], max: 10 });
    await expect(svc.iniciar({ ceps: ['03277'], bairros: [], max: 10 })).rejects.toBeInstanceOf(ConflictException);
    const t0 = Date.now();
    await svc.onModuleDestroy();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(svc.status()).toMatchObject({ status: 'cancelada' });
    // depois de terminar, pode iniciar outro
    await expect(svc.iniciar({ ceps: ['03277'], bairros: [], max: 10 })).resolves.toMatchObject({ status: 'processando' });
    await svc.onModuleDestroy();
  });
});
