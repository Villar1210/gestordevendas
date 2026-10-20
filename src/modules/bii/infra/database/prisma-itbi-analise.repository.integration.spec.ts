// Fatia 2 (integracao - Postgres REAL): busca no bounding box, contagem sem
// localizacao, chaves sem ponto + aplicar coordenadas (job de geocodificacao
// com geocodificador FAKE - nada de rede), cache e ISOLAMENTO DE TENANT das
// analises salvas. Sem DATABASE_URL o teste e pulado.
import { createHash, randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaItbiRepository } from './prisma-itbi.repository';
import { PrismaBiiAnaliseRepository } from './prisma-bii-analise.repository';
import { PrismaGeocodeCacheRepository } from './prisma-geocode-cache.repository';
import { PrismaItbiImportacaoRepository } from './prisma-itbi-importacao.repository';
import { LinhaItbiParaGravar } from '../../domain/repositories/itbi-repository.interface';
import { dataUtc } from '../../domain/services/data-utc';
import { boundingBox } from '../../domain/services/geo';
import { GeocodificacaoItbiService } from '../../application/services/geocodificacao-itbi.service';
import { IGeocodingComCache, ResultadoComFonte } from '../../domain/ports/geocoding-provider.interface';
import { AnalisarEnderecoUseCase } from '../../application/use-cases/analisar-endereco.use-case';
import { GetAnaliseUseCase, ListAnalisesUseCase } from '../../application/use-cases/analises-salvas.use-case';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;
const LOGRADOURO = 'R TESTE BII REPO';
const CEP_PREFIXO = '09998'; // fora da cidade de SP: nao colide com o ITBI real
const USER = '00000000-0000-4000-8000-000000000002';
// Centro sintetico dentro da Grande SP; so estas linhas tem lat/lng aqui (o
// ITBI real importado no banco de dev ainda nao foi geocodificado).
const CENTRO = { lat: -23.7001, lng: -46.4001 };

function nova(n: number, importacaoId: string, extra: Partial<LinhaItbiParaGravar> = {}): LinhaItbiParaGravar {
  const base: LinhaItbiParaGravar = {
    sqlCadastro: String(90000000000 + n),
    logradouro: `${LOGRADOURO} ${n % 3}`,
    numero: String(10 + (n % 3)),
    complemento: null,
    referencia: null,
    bairro: 'BAIRRO TESTE',
    bairroNormalizado: 'bairro teste bii',
    cep: `${CEP_PREFIXO}000`,
    cepPrefixo: CEP_PREFIXO,
    enderecoChave: `rua teste bii repo ${n % 3}|${10 + (n % 3)}|${CEP_PREFIXO}000`,
    naturezaCodigo: 1,
    naturezaTransacao: 'Compra e venda',
    valorTransacao: 400_000 + n,
    dataTransacao: dataUtc(2026, 6, 1 + (n % 20)),
    valorVenalReferencia: null,
    proporcaoTransmitida: 100,
    tipoFinanciamentoCodigo: null,
    tipoFinanciamento: null,
    valorFinanciado: null,
    situacaoSql: 'Ativo Predial',
    areaTerreno: null,
    fracaoIdeal: 0.0123456789,
    areaConstruida: 50,
    usoIptu: 20,
    usoDescricao: 'APARTAMENTO EM CONDOMÍNIO',
    padraoIptu: 13,
    padraoDescricao: null,
    accIptu: 2010,
    hashLinha: createHash('sha256').update(`repo-spec-${n}`).digest('hex'),
    importacaoId,
    arquivoAba: 'JUL-2026',
  };
  return { ...base, ...extra };
}

descrever('BII Fatia 2 - repositorios (integracao - banco real)', () => {
  let prisma: PrismaService;
  let itbi: PrismaItbiRepository;
  let cache: PrismaGeocodeCacheRepository;
  let analises: PrismaBiiAnaliseRepository;
  let importacaoId: string;
  const tenantIds: string[] = [];

  const limpar = async () => {
    await prisma.itbiTransacao.deleteMany({ where: { logradouro: { startsWith: LOGRADOURO } } });
    await prisma.itbiImportacao.deleteMany({ where: { importadoPorUserId: USER } });
    await prisma.geocodeCache.deleteMany({ where: { chave: { contains: 'teste bii repo' } } });
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = new PrismaService();
    await prisma.$connect();
    itbi = new PrismaItbiRepository(prisma);
    cache = new PrismaGeocodeCacheRepository(prisma);
    analises = new PrismaBiiAnaliseRepository(prisma);
    await limpar();
    importacaoId = (await new PrismaItbiImportacaoRepository(prisma).criar({ nomeArquivo: 'repo.xlsx', ano: 2026, importadoPorUserId: USER })).id;
  });

  afterAll(async () => {
    await limpar();
    if (tenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
    jest.restoreAllMocks();
  });

  it('inserirLote (unnest) grava todos os tipos e ignora hash repetido', async () => {
    const lote = Array.from({ length: 9 }, (_, i) => nova(i, importacaoId));
    expect(await itbi.inserirLote(lote)).toBe(9);
    expect(await itbi.inserirLote([lote[0], nova(100, importacaoId)])).toBe(1);
    const r = await prisma.itbiTransacao.findFirstOrThrow({ where: { hashLinha: lote[0].hashLinha } });
    expect(r).toMatchObject({ logradouro: `${LOGRADOURO} 0`, cepPrefixo: CEP_PREFIXO, usoIptu: 20, padraoDescricao: null, latitude: null });
    expect(Number(r.fracaoIdeal)).toBeCloseTo(0.0123456789, 10);
    expect(r.dataTransacao.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('job de geocodificacao (geocodificador fake): so a regiao pedida, 1 consulta por chave, grava em todas as guias', async () => {
    const chaves = await itbi.listarChavesSemPonto({ cepPrefixos: [CEP_PREFIXO], bairrosNormalizados: [], limite: 100 });
    expect(chaves.sort()).toEqual([0, 1, 2].map((k) => `rua teste bii repo ${k}|${10 + k}|${CEP_PREFIXO}000`));
    expect(await itbi.listarChavesSemPonto({ cepPrefixos: [], bairrosNormalizados: ['bairro teste bii'], limite: 2 })).toHaveLength(2);

    const consultas: string[] = [];
    const fake: IGeocodingComCache = {
      nome: 'fake',
      geocodificar: async () => null,
      geocodificarComFonte: async (consulta: string): Promise<ResultadoComFonte> => {
        consultas.push(consulta);
        if (consulta.includes('repo 2')) return { fonte: 'provedor', resultado: null }; // nao achou
        const desloc = consulta.includes('repo 0') ? 0.001 : 0.003;
        return {
          fonte: 'provedor',
          resultado: { lat: CENTRO.lat + desloc, lng: CENTRO.lng, precisao: 'rooftop', enderecoFormatado: 'x', cep: null },
        };
      },
    };
    const job = new GeocodificacaoItbiService(itbi, fake);
    const inicio = await job.iniciar({ ceps: [CEP_PREFIXO], bairros: [], max: 100 });
    expect(inicio.enfileirados).toBe(3);
    await job.aguardar();
    expect(job.status()).toMatchObject({ status: 'concluida', processados: 3, encontrados: 2, naoEncontrados: 1, transacoesAtualizadas: 7 });
    expect(consultas).toHaveLength(3);
    expect(await prisma.itbiTransacao.count({ where: { logradouro: { startsWith: LOGRADOURO }, latitude: { not: null } } })).toBe(7);
  });

  it('buscarNoBbox (periodo + natureza) e contarSemLocalizacao', async () => {
    const f = { bbox: boundingBox(CENTRO, 1000), de: dataUtc(2026, 6, 1), ateExclusivo: dataUtc(2026, 7, 1), limite: 100 };
    const todas = await itbi.buscarNoBbox({ ...f, naturezaCodigo: 1 });
    expect(todas).toHaveLength(7);
    expect(todas[0]).toMatchObject({ areaConstruida: 50, usoIptu: 20, naturezaCodigo: 1 });
    expect(typeof todas[0].valorTransacao).toBe('number');
    expect(await itbi.buscarNoBbox({ ...f, naturezaCodigo: 20 })).toHaveLength(0);
    expect(await itbi.buscarNoBbox({ ...f, naturezaCodigo: 1, ateExclusivo: dataUtc(2026, 6, 2) })).toHaveLength(2); // n=0 e n=100 em 01/07
    expect(await itbi.buscarNoBbox({ ...f, naturezaCodigo: 1, limite: 2 })).toHaveLength(2);
    expect(await itbi.contarSemLocalizacao({ cepPrefixo: CEP_PREFIXO, de: f.de, ateExclusivo: f.ateExclusivo, naturezaCodigo: 1 })).toBe(3);
  });

  it('GeocodeCache: upsert por chave, inclusive "nao achou"', async () => {
    await cache.gravar({ chave: 'itbi:teste bii repo x', provedor: 'nominatim', lat: null, lng: null, precisao: null, enderecoFormatado: null });
    await cache.gravar({ chave: 'itbi:teste bii repo x', provedor: 'nominatim', lat: -23.6, lng: -46.5, precisao: 'rua', enderecoFormatado: 'R X' });
    expect(await cache.buscar('itbi:teste bii repo x')).toMatchObject({ lat: -23.6, lng: -46.5, precisao: 'rua' });
    expect(await cache.buscar('itbi:teste bii repo nada')).toBeNull();
  });

  it('ISOLAMENTO DE TENANT: analise do tenant A nunca aparece/abre no B (fluxo real com repositorios Prisma)', async () => {
    const tA = await prisma.tenant.create({ data: { name: 'BII F2 teste A' } });
    const tB = await prisma.tenant.create({ data: { name: 'BII F2 teste B' } });
    tenantIds.push(tA.id, tB.id);
    const geo = { nome: 'fake', geocodificar: async () => ({ lat: CENTRO.lat, lng: CENTRO.lng, precisao: 'rooftop' as const, enderecoFormatado: 'Centro teste', cep: `${CEP_PREFIXO}000` }) };
    const uc = new AnalisarEnderecoUseCase(geo, itbi, analises);
    const base = { requesterRole: 'Administrador', requesterUserId: randomUUID(), impersonadoPor: null, agora: new Date(2026, 9, 20) };
    const a = await uc.execute({ ...base, tenantId: tA.id, endereco: 'Endereco A, 1, Sao Paulo' });
    const b = await uc.execute({ ...base, tenantId: tB.id, endereco: 'Endereco B, 2, Sao Paulo', meses: 6 });
    expect(a.resumo.transacoes).toBe(7);
    expect(a.resumo.precoM2Mediano).toBeGreaterThan(8000);
    expect(a.cobertura.semLocalizacao).toBe(3);

    const list = new ListAnalisesUseCase(analises);
    const get = new GetAnaliseUseCase(analises);
    expect((await list.execute({ tenantId: tA.id, requesterRole: 'Administrador' })).map((x) => x.id)).toEqual([a.id]);
    expect((await list.execute({ tenantId: tB.id, requesterRole: 'Administrador' })).map((x) => x.id)).toEqual([b.id]);
    await expect(get.execute({ tenantId: tA.id, requesterRole: 'Administrador', id: b.id })).rejects.toThrow('não encontrada');
    const aberta = await get.execute({ tenantId: tA.id, requesterRole: 'Administrador', id: a.id });
    expect(aberta).toMatchObject({ id: a.id, resumo: a.resumo, parametros: a.parametros, criadoEm: a.criadoEm });

    // cascata: excluir o tenant apaga as analises dele
    await prisma.tenant.delete({ where: { id: tB.id } });
    tenantIds.pop();
    expect(await prisma.biiAnalise.count({ where: { id: b.id } })).toBe(0);
  });
});
