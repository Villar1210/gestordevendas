import { ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import {
  GeocodeResultado,
  GeocodingIndisponivelError,
  IGeocodingProvider,
} from '../../domain/ports/geocoding-provider.interface';
import {
  BiiAnaliseCompleta,
  BiiAnaliseResumo,
  IBiiAnaliseRepository,
  NovaBiiAnalise,
} from '../../domain/repositories/bii-analise-repository.interface';
import { FiltroBbox, IItbiRepository } from '../../domain/repositories/itbi-repository.interface';
import { TransacaoParaAnalise } from '../../domain/services/analise-endereco';
import { dataUtc } from '../../domain/services/data-utc';
import {
  AnalisarEnderecoUseCase,
  analisesPorDia,
  MENSAGEM_COTA_DIARIA,
  MENSAGEM_ENDERECO_NAO_ENCONTRADO,
  MENSAGEM_SOMENTE_LEITURA,
  OBSERVACAO_FONTE,
} from './analisar-endereco.use-case';
import { GetAnaliseUseCase, ListAnalisesUseCase } from './analises-salvas.use-case';
import { ConcorrenteRepoFake } from '../../../../../test/bii/concorrente-repo.fake';

const PONTO: GeocodeResultado = {
  lat: -23.5934,
  lng: -46.5627,
  precisao: 'rooftop',
  enderecoFormatado: 'Rua Ibitirama, 100, Vila Prudente, São Paulo, 03134-000, Brasil',
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

class ItbiFake implements Partial<IItbiRepository> {
  linhas: TransacaoParaAnalise[] = [];
  maior: Date | null = dataUtc(2026, 8, 7);
  filtros: FiltroBbox[] = [];
  semLoc: unknown[] = [];
  async buscarNoBbox(f: FiltroBbox) {
    this.filtros.push(f);
    return this.linhas;
  }
  async contarSemLocalizacao(f: unknown) {
    this.semLoc.push(f);
    return 7;
  }
  async maiorDataTransacao() {
    return this.maior;
  }
}

// Repositorio fake que RESPEITA tenantId (mesma regra do Prisma)
class AnaliseFake implements IBiiAnaliseRepository {
  salvas: (NovaBiiAnalise & { id: string; createdAt: Date })[] = [];
  async criar(d: NovaBiiAnalise) {
    const r = { ...d, id: `a${this.salvas.length + 1}`, createdAt: new Date('2026-10-20T12:00:00Z') };
    this.salvas.push(r);
    return { id: r.id, createdAt: r.createdAt };
  }
  async listarPorTenant(tenantId: string, limite: number): Promise<BiiAnaliseResumo[]> {
    return this.salvas
      .filter((s) => s.tenantId === tenantId)
      .slice(0, limite)
      .map((s) => ({ ...s, createdAt: s.createdAt }));
  }
  async buscarPorIdETenant(id: string, tenantId: string): Promise<BiiAnaliseCompleta | null> {
    const s = this.salvas.find((x) => x.id === id && x.tenantId === tenantId);
    return s ? { id: s.id, resultado: s.resultado, createdAt: s.createdAt } : null;
  }
  contagens: { tenantId: string; desde: Date }[] = [];
  doDia = 0;
  async contarDesde(tenantId: string, desde: Date) {
    this.contagens.push({ tenantId, desde });
    return this.doDia;
  }
}

function linha(p: Partial<TransacaoParaAnalise> = {}): TransacaoParaAnalise {
  return {
    dataTransacao: dataUtc(2026, 6, 10),
    logradouro: 'R IBITIRAMA',
    numero: '200',
    bairro: 'VL PRUDENTE',
    areaConstruida: 50,
    valorTransacao: 400_000,
    latitude: PONTO.lat + 0.001,
    longitude: PONTO.lng,
    usoIptu: 20,
    naturezaCodigo: 1,
    tipoFinanciamentoCodigo: 2,
    tipoFinanciamento: 'Minha Casa Minha Vida',
    ...p,
  };
}

function montar() {
  const geo = new GeoFake();
  const itbi = new ItbiFake();
  const analises = new AnaliseFake();
  const concorrentes = new ConcorrenteRepoFake();
  const uc = new AnalisarEnderecoUseCase(geo, itbi as unknown as IItbiRepository, analises, concorrentes);
  return { geo, itbi, analises, concorrentes, uc };
}

const BASE = {
  tenantId: 'tenant-a',
  requesterRole: 'Administrador',
  requesterUserId: 'u-admin',
  impersonadoPor: null,
  endereco: 'Rua Ibitirama, 100 - Vila Prudente, São Paulo',
  agora: new Date(2026, 9, 20, 10),
};

describe('AnalisarEnderecoUseCase', () => {
  it('so Administrador (checado no use case)', async () => {
    const { uc, geo } = montar();
    for (const role of ['Corretor', 'Corretor Parceiro', 'Cliente', 'Super Usuario']) {
      await expect(uc.execute({ ...BASE, requesterRole: role })).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(geo.consultas).toHaveLength(0);
  });

  it('resposta completa no formato do contrato, com padroes (1000 m, 12 meses, residencial, compra e venda)', async () => {
    const { uc, itbi, analises } = montar();
    itbi.linhas = [linha(), linha({ valorTransacao: 500_000 }), linha({ usoIptu: 0, areaConstruida: 0, valorTransacao: 260_000 })];
    const r = await uc.execute(BASE);
    expect(r).toMatchObject({
      id: 'a1',
      endereco: { digitado: BASE.endereco, formatado: PONTO.enderecoFormatado, lat: PONTO.lat, lng: PONTO.lng, precisao: 'rooftop' },
      parametros: { raioMetros: 1000, meses: 12, areaMin: null, areaMax: null, tipo: 'residencial', somenteCompraVenda: true, de: '2025-10-01', ate: '2026-09-07' },
      cobertura: { semLocalizacao: 7, transacoesNoPeriodoNaRegiao: 3 + 7 },
      resumo: { transacoes: 2, precoM2Mediano: 9000, precoM2P25: 8500, precoM2P75: 9500, valorMediano: 450_000, areaMediana: 50 },
      planta: { transacoes: 1, valorMediano: 260_000, comMcmv: 1 },
      financiamento: { mcmv: 3, sfh: 0, outros: 0, semFinanciamento: 0 },
      fonte: { nome: 'ITBI — Prefeitura de São Paulo', atualizadoAte: '2026-09-07', observacao: OBSERVACAO_FONTE },
      criadoEm: '2026-10-20T12:00:00.000Z',
    });
    expect(r.porMes).toHaveLength(12);
    expect(r.amostra).toHaveLength(2);
    expect(itbi.filtros[0]).toMatchObject({ naturezaCodigo: 1, limite: 20_000 });
    expect(itbi.filtros[0].de.toISOString()).toBe('2025-10-01T00:00:00.000Z');
    expect(itbi.filtros[0].ateExclusivo.toISOString()).toBe('2026-09-08T00:00:00.000Z');
    expect(analises.salvas[0]).toMatchObject({ tenantId: 'tenant-a', createdById: 'u-admin', transacoes: 2, precoM2Mediano: 9000, raioMetros: 1000 });
    // snapshot sem id/criadoEm
    expect(analises.salvas[0].resultado).not.toHaveProperty('id');
  });

  it('periodo termina em hoje quando o ITBI ja passa de hoje ou nao ha dado', async () => {
    const { uc, itbi } = montar();
    itbi.maior = null;
    const r = await uc.execute({ ...BASE, meses: 6 });
    expect(r.parametros).toMatchObject({ de: '2026-05-01', ate: '2026-10-20' });
    expect(r.fonte.atualizadoAte).toBeNull();
    expect(r.resumo.transacoes).toBe(0);
  });

  it('somenteCompraVenda=false nao filtra natureza; CEP ausente -> semLocalizacao 0 (nao inventa)', async () => {
    const { uc, itbi, geo } = montar();
    geo.resposta = { ...PONTO, cep: null };
    const r = await uc.execute({ ...BASE, somenteCompraVenda: false });
    expect(itbi.filtros[0].naturezaCodigo).toBeNull();
    expect(r.cobertura.semLocalizacao).toBe(0);
    expect(itbi.semLoc).toHaveLength(0);
  });

  it('nao encontrado ou fora da Grande SP -> 422 com a mensagem do contrato', async () => {
    const { uc, geo } = montar();
    geo.resposta = null;
    await expect(uc.execute(BASE)).rejects.toThrow(new UnprocessableEntityException(MENSAGEM_ENDERECO_NAO_ENCONTRADO));
    geo.resposta = { ...PONTO, lat: -22.9, lng: -43.2 }; // Rio
    await expect(uc.execute(BASE)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('geocodificador indisponivel -> 503', async () => {
    const { uc, geo } = montar();
    geo.resposta = new GeocodingIndisponivelError('timeout');
    await expect(uc.execute(BASE)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('validacoes: raio, meses, area min > max, endereco curto', async () => {
    const { uc } = montar();
    await expect(uc.execute({ ...BASE, raioMetros: 300 })).rejects.toThrow('Raio');
    await expect(uc.execute({ ...BASE, meses: 18 })).rejects.toThrow('Período');
    await expect(uc.execute({ ...BASE, areaMin: 90, areaMax: 40 })).rejects.toThrow('área mínima');
    await expect(uc.execute({ ...BASE, endereco: ' \n a \u202e ' })).rejects.toThrow('endereço');
  });

  it('B1: Super Usuario impersonando -> 403 BII_SOMENTE_LEITURA, sem geocodificar nem gravar', async () => {
    const { uc, geo, analises } = montar();
    const erro = await uc.execute({ ...BASE, impersonadoPor: 'su-1' }).catch((e) => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    expect((erro as HttpException).getResponse()).toEqual({ statusCode: 403, code: 'BII_SOMENTE_LEITURA', message: MENSAGEM_SOMENTE_LEITURA });
    expect(geo.consultas).toHaveLength(0);
    expect(analises.salvas).toHaveLength(0);
  });

  it('log de auditoria sem o endereco', async () => {
    const { uc } = montar();
    const log = jest.spyOn((uc as unknown as { logger: { log: (m: string) => void } }).logger, 'log').mockImplementation(() => undefined);
    await uc.execute(BASE);
    const msg = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(msg).toContain('tenant=tenant-a');
    expect(msg).not.toMatch(/Ibitirama/i);
  });

  it('M2: cota diaria por tenant -> 429 BII_COTA_DIARIA antes de geocodificar; conta desde a meia-noite local', async () => {
    const { uc, geo, analises } = montar();
    uc.limitePorDia = () => 3;
    analises.doDia = 2;
    await expect(uc.execute(BASE)).resolves.toBeDefined();
    expect(analises.contagens[0]).toEqual({ tenantId: 'tenant-a', desde: new Date(2026, 9, 20) });
    analises.doDia = 3;
    geo.consultas = [];
    const erro = await uc.execute(BASE).catch((e) => e);
    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(429);
    expect((erro as HttpException).getResponse()).toEqual({ statusCode: 429, code: 'BII_COTA_DIARIA', message: MENSAGEM_COTA_DIARIA });
    expect(geo.consultas).toHaveLength(0);
  });

  it('analisesPorDia: env BII_ANALISES_POR_DIA opcional, padrao 200', () => {
    expect(analisesPorDia(undefined)).toBe(200);
    expect(analisesPorDia('50')).toBe(50);
    expect(analisesPorDia('0')).toBe(200);
    expect(analisesPorDia('abc')).toBe(200);
  });

  it('B2: acerto de cache sem endereco formatado -> usa o texto digitado', async () => {
    const { uc, geo, analises } = montar();
    geo.resposta = { ...PONTO, enderecoFormatado: '' };
    const r = await uc.execute(BASE);
    expect(r.endereco.formatado).toBe(BASE.endereco);
    expect(analises.salvas[0].enderecoFormatado).toBe(BASE.endereco);
  });
});

describe('AnalisarEnderecoUseCase - concorrentes no raio (Fatia 3)', () => {
  it('devolve so concorrentes do PROPRIO tenant dentro do raio, mais proximos primeiro, e grava no snapshot', async () => {
    const { uc, concorrentes, analises } = montar();
    // ~111 m por 0.001 grau de latitude
    concorrentes.semear('tenant-a', { nome: 'Perto', lat: PONTO.lat + 0.002, lng: PONTO.lng, totalUnidades: 200, observacoes: 'texto livre', fonte: 'stand', fonteUrl: 'https://x.com.br' });
    concorrentes.semear('tenant-a', { nome: 'Pertissimo', lat: PONTO.lat + 0.001, lng: PONTO.lng, totalUnidades: 100 });
    concorrentes.semear('tenant-a', { nome: 'Fora do raio', lat: PONTO.lat + 0.02, lng: PONTO.lng });
    concorrentes.semear('tenant-b', { nome: 'Outro tenant', lat: PONTO.lat, lng: PONTO.lng });
    const r = await uc.execute(BASE);
    expect(r.concorrentes.itens.map((c) => c.nome)).toEqual(['Pertissimo', 'Perto']);
    expect(r.concorrentes.itens[0].distanciaMetros).toBeGreaterThan(100);
    expect(r.concorrentes.itens[0].distanciaMetros).toBeLessThan(120);
    expect(r.concorrentes.itens[0].calculado.precoM2Mediano).toBe(7000);
    expect(r.concorrentes.resumo).toEqual({ quantidade: 2, precoM2Mediano: 7000, unidadesTotais: 300 });
    expect((analises.salvas[0].resultado as { concorrentes: unknown }).concorrentes).toEqual(r.concorrentes);
    // snapshot sem textos livres (LGPD: excluir o concorrente nao deixa esses textos nas analises)
    expect(r.concorrentes.itens[0]).not.toHaveProperty('observacoes');
    expect(r.concorrentes.itens[0]).not.toHaveProperty('fonte');
    expect(r.concorrentes.itens[0]).not.toHaveProperty('fonteUrl');
  });

  it('sem concorrentes cadastrados -> lista vazia e resumo zerado', async () => {
    const { uc } = montar();
    const r = await uc.execute(BASE);
    expect(r.concorrentes).toEqual({ itens: [], resumo: { quantidade: 0, precoM2Mediano: null, unidadesTotais: null } });
  });
});

describe('Analises salvas - isolamento de tenant', () => {
  it('lista e abre so do proprio tenant; de outro tenant -> 404', async () => {
    const { uc, analises } = montar();
    await uc.execute(BASE);
    await uc.execute({ ...BASE, tenantId: 'tenant-b', endereco: 'Rua B, 1, São Paulo' });
    const list = new ListAnalisesUseCase(analises);
    const get = new GetAnaliseUseCase(analises);
    const a = await list.execute({ tenantId: 'tenant-a', requesterRole: 'Administrador' });
    expect(a.map((x) => x.id)).toEqual(['a1']);
    expect(a[0]).toMatchObject({ endereco: BASE.endereco, raioMetros: 1000, meses: 12, transacoes: 0, precoM2Mediano: null });
    await expect(get.execute({ tenantId: 'tenant-a', requesterRole: 'Administrador', id: 'a2' })).rejects.toBeInstanceOf(NotFoundException);
    const aberta = await get.execute({ tenantId: 'tenant-b', requesterRole: 'Administrador', id: 'a2' });
    expect(aberta).toMatchObject({ id: 'a2', criadoEm: '2026-10-20T12:00:00.000Z', parametros: { raioMetros: 1000 } });
    await expect(list.execute({ tenantId: 'tenant-a', requesterRole: 'Corretor' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(get.execute({ tenantId: 'tenant-a', requesterRole: 'Corretor', id: 'a1' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
