import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GeocodeResultado, GeocodingIndisponivelError, IGeocodingProvider } from '../../domain/ports/geocoding-provider.interface';
import { MAX_CONCORRENTES_POR_TENANT } from '../../domain/services/concorrente';
import { ConcorrenteRepoFake } from '../../../../../test/bii/concorrente-repo.fake';
import {
  ConcorrenteEntrada,
  ConcorrenteGeocodificador,
  CreateConcorrenteUseCase,
  DeleteConcorrenteUseCase,
  GetConcorrenteUseCase,
  ListConcorrentesUseCase,
  MENSAGEM_PONTO_FORA,
  UpdateConcorrenteUseCase,
} from './concorrentes.use-cases';
import { MENSAGEM_SOMENTE_LEITURA_CONCORRENTES } from './permissoes-bii';

const PONTO: GeocodeResultado = {
  lat: -23.5934,
  lng: -46.5627,
  precisao: 'rooftop',
  enderecoFormatado: 'Rua Ibitirama, 200, Vila Prudente, São Paulo',
  cep: '03134000',
};

class GeoFake implements IGeocodingProvider {
  readonly nome = 'fake';
  resposta: GeocodeResultado | null | Error = PONTO;
  consultas: string[] = [];
  async geocodificar(consulta: string) {
    this.consultas.push(consulta);
    if (this.resposta instanceof Error) throw this.resposta;
    return this.resposta;
  }
}

const AGORA = new Date('2026-10-20T12:00:00Z');
const REQ = { tenantId: 'tenant-a', requesterRole: 'Administrador', requesterUserId: 'u-admin', impersonadoPor: null, agora: AGORA };
const DADOS: ConcorrenteEntrada = {
  nome: '  Residencial  Vista ',
  construtora: 'Construtora X',
  endereco: 'Rua Ibitirama, 200, São Paulo',
  fase: 'lancamento',
  dataLancamento: '2025-12-20',
  totalUnidades: 240,
  unidadesVendidas: 120,
  fonte: 'visita ao stand',
  fonteUrl: 'https://construtorax.com.br/vista',
  observacoes: 'Stand aberto aos sábados.',
  tipologias: [
    { descricao: '2 dorm.', dormitorios: 2, areaPrivativa: 40, precoDe: 280_000, precoAte: 320_000 },
    { descricao: '3 dorm.', dormitorios: 3, areaPrivativa: 60, precoDe: 540_000, precoAte: null },
  ],
};

function montar() {
  const repo = new ConcorrenteRepoFake();
  repo.agora = AGORA;
  const geo = new GeoFake();
  const geoc = new ConcorrenteGeocodificador(geo);
  return {
    repo,
    geo,
    criar: new CreateConcorrenteUseCase(repo, geoc),
    atualizar: new UpdateConcorrenteUseCase(repo, geoc),
    excluir: new DeleteConcorrenteUseCase(repo),
    listar: new ListConcorrentesUseCase(repo),
    abrir: new GetConcorrenteUseCase(repo),
  };
}

describe('CreateConcorrenteUseCase', () => {
  it('cria geocodificando, normaliza textos e devolve os numeros calculados', async () => {
    const { criar, geo, repo } = montar();
    const r = await criar.execute({ ...REQ, dados: DADOS });
    expect(geo.consultas).toEqual(['Rua Ibitirama, 200, São Paulo']);
    expect(r).toMatchObject({
      nome: 'Residencial Vista',
      lat: PONTO.lat,
      lng: PONTO.lng,
      precisao: 'rooftop',
      enderecoFormatado: PONTO.enderecoFormatado,
      dataLancamento: '2025-12-20',
      origem: 'manual',
      calculado: { precoM2Mediano: 8000, precoM2Min: 7000, precoM2Max: 9000, percentualVendido: 50, vendasPorMes: 12, desatualizado: false },
    });
    expect(r.tipologias[0]).toMatchObject({ precoM2De: 7000, precoM2Ate: 8000 });
    expect(repo.itens[0]).toMatchObject({ tenantId: 'tenant-a', createdById: 'u-admin', updatedById: 'u-admin' });
  });

  it('pino manual: nao geocodifica e grava precisao "manual"', async () => {
    const { criar, geo } = montar();
    const r = await criar.execute({ ...REQ, dados: { ...DADOS, latitude: -23.6, longitude: -46.57 } });
    expect(geo.consultas).toEqual([]);
    expect(r).toMatchObject({ lat: -23.6, lng: -46.57, precisao: 'manual' });
  });

  it.each([
    [{ latitude: -23.6, longitude: null }, 'juntas'],
    [{ latitude: -22.9, longitude: -43.2 }, MENSAGEM_PONTO_FORA], // Rio
    [{ fase: 'vendido' }, 'Fase inválida'],
    [{ nome: ' x ' }, 'nome do empreendimento'],
    [{ endereco: 'Rua' }, 'entre 5 e 200'],
    [{ dataLancamento: '2026-02-31' }, 'Data de lançamento'],
    [{ unidadesVendidas: 300 }, 'não podem passar'],
    [{ tipologias: [] }, 'ao menos uma'],
    [{ tipologias: [{ descricao: '2d', dormitorios: null, areaPrivativa: 40, precoDe: 300_000, precoAte: 200_000 }] }, 'não pode ser menor'],
    [{ fonteUrl: 'http://site.com' }, 'https://'],
    [{ fonteUrl: 'javascript:alert(1)' }, 'https://'],
  ])('400 para %p', async (extra, trecho) => {
    const { criar, geo } = montar();
    const p = criar.execute({ ...REQ, dados: { ...DADOS, ...extra } as ConcorrenteEntrada });
    await expect(p).rejects.toBeInstanceOf(BadRequestException);
    await expect(p).rejects.toThrow(trecho);
    expect(geo.consultas).toEqual([]); // valida antes de gastar geocodificacao
  });

  it('endereco nao encontrado ou fora da Grande SP -> 422; provedor fora -> 503', async () => {
    const { criar, geo } = montar();
    geo.resposta = null;
    await expect(criar.execute({ ...REQ, dados: DADOS })).rejects.toBeInstanceOf(UnprocessableEntityException);
    geo.resposta = { ...PONTO, lat: -22.9, lng: -43.2 };
    await expect(criar.execute({ ...REQ, dados: DADOS })).rejects.toBeInstanceOf(UnprocessableEntityException);
    geo.resposta = new GeocodingIndisponivelError('fora');
    await expect(criar.execute({ ...REQ, dados: DADOS })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('so Administrador; impersonacao -> 403 BII_SOMENTE_LEITURA (antes de geocodificar)', async () => {
    const { criar, geo } = montar();
    await expect(criar.execute({ ...REQ, requesterRole: 'Corretor', dados: DADOS })).rejects.toBeInstanceOf(ForbiddenException);
    const erro = await criar.execute({ ...REQ, impersonadoPor: 'su-1', dados: DADOS }).catch((e) => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    expect((erro as HttpException).getResponse()).toEqual({ statusCode: 403, code: 'BII_SOMENTE_LEITURA', message: MENSAGEM_SOMENTE_LEITURA_CONCORRENTES });
    expect(geo.consultas).toEqual([]);
  });

  it(`limite de ${MAX_CONCORRENTES_POR_TENANT} por tenant -> 409 (outro tenant nao conta)`, async () => {
    const { criar, repo, geo } = montar();
    for (let i = 0; i < MAX_CONCORRENTES_POR_TENANT; i++) repo.semear('tenant-a', { lat: -23.6, lng: -46.5 });
    repo.semear('tenant-b', { lat: -23.6, lng: -46.5 });
    await expect(criar.execute({ ...REQ, dados: DADOS })).rejects.toBeInstanceOf(ConflictException);
    expect(geo.consultas).toEqual([]);
    await expect(criar.execute({ ...REQ, tenantId: 'tenant-b', dados: DADOS })).resolves.toMatchObject({ nome: 'Residencial Vista' });
  });
});

describe('UpdateConcorrenteUseCase', () => {
  it('endereco igual: mantem o ponto (inclusive ajuste manual) e nao geocodifica', async () => {
    const { criar, atualizar, geo } = montar();
    const c = await criar.execute({ ...REQ, dados: { ...DADOS, latitude: -23.6, longitude: -46.57 } });
    const r = await atualizar.execute({ ...REQ, id: c.id, dados: { ...DADOS, nome: 'Novo nome', tipologias: [DADOS.tipologias[1]] } });
    expect(geo.consultas).toEqual([]);
    expect(r).toMatchObject({ nome: 'Novo nome', lat: -23.6, lng: -46.57, precisao: 'manual' });
    expect(r.tipologias).toHaveLength(1); // tipologias substituidas
  });

  it('endereco mudou: geocodifica de novo; pino manual informado vence', async () => {
    const { criar, atualizar, geo } = montar();
    const c = await criar.execute({ ...REQ, dados: DADOS });
    geo.resposta = { ...PONTO, lat: -23.58, enderecoFormatado: 'Outro' };
    const r = await atualizar.execute({ ...REQ, id: c.id, dados: { ...DADOS, endereco: 'Rua Nova, 10, São Paulo' } });
    expect(geo.consultas).toEqual(['Rua Ibitirama, 200, São Paulo', 'Rua Nova, 10, São Paulo']);
    expect(r).toMatchObject({ lat: -23.58, enderecoFormatado: 'Outro' });
    const m = await atualizar.execute({ ...REQ, id: c.id, dados: { ...DADOS, endereco: 'Rua Outra, 5, SP', latitude: -23.61, longitude: -46.58 } });
    expect(geo.consultas).toHaveLength(2);
    expect(m).toMatchObject({ lat: -23.61, lng: -46.58, precisao: 'manual' });
  });

  it('ISOLAMENTO: editar concorrente de outro tenant -> 404 e nada muda', async () => {
    const { criar, atualizar, repo } = montar();
    const c = await criar.execute({ ...REQ, dados: DADOS });
    await expect(atualizar.execute({ ...REQ, tenantId: 'tenant-b', id: c.id, dados: { ...DADOS, nome: 'Invadido' } })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.itens[0].nome).toBe('Residencial Vista');
  });

  it('impersonacao -> 403', async () => {
    const { criar, atualizar } = montar();
    const c = await criar.execute({ ...REQ, dados: DADOS });
    await expect(atualizar.execute({ ...REQ, impersonadoPor: 'su', id: c.id, dados: DADOS })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Delete / List / Get', () => {
  it('ISOLAMENTO: lista e abre so do proprio tenant; excluir de outro tenant -> 404', async () => {
    const { criar, excluir, listar, abrir, repo } = montar();
    const a = await criar.execute({ ...REQ, dados: DADOS });
    const b = await criar.execute({ ...REQ, tenantId: 'tenant-b', dados: { ...DADOS, nome: 'Do B' } });
    expect((await listar.execute({ tenantId: 'tenant-a', requesterRole: 'Administrador', agora: AGORA })).map((c) => c.id)).toEqual([a.id]);
    await expect(abrir.execute({ tenantId: 'tenant-a', requesterRole: 'Administrador', id: b.id })).rejects.toBeInstanceOf(NotFoundException);
    expect(await abrir.execute({ tenantId: 'tenant-b', requesterRole: 'Administrador', id: b.id })).toMatchObject({ nome: 'Do B' });
    await expect(excluir.execute({ ...REQ, id: b.id })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.itens).toHaveLength(2);
    await excluir.execute({ ...REQ, id: a.id });
    expect(repo.itens.map((c) => c.id)).toEqual([b.id]);
  });

  it('leitura liberada na impersonacao; exclusao nao; Corretor nunca', async () => {
    const { criar, excluir, listar, abrir } = montar();
    const a = await criar.execute({ ...REQ, dados: DADOS });
    await expect(excluir.execute({ ...REQ, impersonadoPor: 'su', id: a.id })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(listar.execute({ tenantId: 'tenant-a', requesterRole: 'Corretor' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(abrir.execute({ tenantId: 'tenant-a', requesterRole: 'Corretor', id: a.id })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(excluir.execute({ ...REQ, requesterRole: 'Corretor', id: a.id })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
