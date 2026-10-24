// Fatia 6 (integracao - Postgres REAL): gravacao das quadras/lotes e a
// localizacao das guias pelo SQL (lote exato, quadra, prioridade de precisao,
// filtro por importacao). Linhas sinteticas no setor 999 (nao existe na
// cidade: nao colide com o ITBI real). Sem DATABASE_URL o teste e pulado.
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaGeoSampaRepository } from './prisma-geosampa.repository';
import { PrismaItbiRepository } from './prisma-itbi.repository';
import { PrismaItbiImportacaoRepository } from './prisma-itbi-importacao.repository';
import { LinhaItbiParaGravar } from '../../domain/repositories/itbi-repository.interface';
import { dataUtc } from '../../domain/services/data-utc';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;
const SETOR = '999';
jest.setTimeout(120_000);

function guia(n: number, sql: string, importacaoId: string, extra: Partial<LinhaItbiParaGravar> = {}): LinhaItbiParaGravar {
  return {
    sqlCadastro: sql,
    logradouro: 'R TESTE GEOSAMPA',
    numero: String(n),
    complemento: null,
    referencia: null,
    bairro: 'TESTE',
    bairroNormalizado: 'teste geosampa',
    cep: '09997000',
    cepPrefixo: '09997',
    enderecoChave: `r teste geosampa|${n}|09997000`,
    naturezaCodigo: 1,
    naturezaTransacao: 'Compra e venda',
    valorTransacao: 300_000 + n,
    dataTransacao: dataUtc(2026, 5, 1),
    valorVenalReferencia: null,
    proporcaoTransmitida: 100,
    tipoFinanciamentoCodigo: null,
    tipoFinanciamento: null,
    valorFinanciado: null,
    situacaoSql: 'Ativo Predial',
    areaTerreno: 125,
    fracaoIdeal: 1,
    areaConstruida: 90,
    usoIptu: 10,
    usoDescricao: 'RESIDENCIAL HORIZONTAL',
    padraoIptu: 12,
    padraoDescricao: null,
    accIptu: 2000,
    hashLinha: createHash('sha256').update(`geosampa-spec-${n}-${importacaoId}`).digest('hex'),
    importacaoId,
    arquivoAba: 'TESTE',
    ...extra,
  };
}

descrever('PrismaGeoSampaRepository (integracao)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaGeoSampaRepository(prisma);
  const itbi = new PrismaItbiRepository(prisma);
  const importacoes = new PrismaItbiImportacaoRepository(prisma);
  let impA: string;
  let impB: string;

  const limpar = async () => {
    await prisma.itbiTransacao.deleteMany({ where: { cepPrefixo: '09997' } });
    await prisma.geoLoteFiscal.deleteMany({ where: { setor: SETOR } });
    await prisma.geoQuadraFiscal.deleteMany({ where: { setor: SETOR } });
    await prisma.itbiImportacao.deleteMany({ where: { nomeArquivo: 'geosampa-spec.xlsx' } });
  };

  beforeAll(async () => {
    await limpar();
    impA = (await importacoes.criar({ nomeArquivo: 'geosampa-spec.xlsx', ano: 2026, importadoPorUserId: randomUUID() })).id;
    impB = (await importacoes.criar({ nomeArquivo: 'geosampa-spec.xlsx', ano: 2026, importadoPorUserId: randomUUID() })).id;
    await itbi.inserirLote([
      guia(1, `${SETOR}0010024` + '1', impA), // casa: casa com o lote 0024
      guia(2, `${SETOR}0010777` + '1', impA), // lote sem cadastro: cai na quadra
      guia(3, `${SETOR}0010024` + '1', impA, { fracaoIdeal: 0.01 }), // apartamento: nunca no lote
      guia(4, `${SETOR}0020001` + '1', impB), // outra importacao
      guia(5, `${SETOR}0099999` + '1', impA), // quadra inexistente: fica sem local
    ]);
    // guia 2 ja tinha numero exato pelo Nominatim: quadra NAO pode trocar
    await prisma.itbiTransacao.updateMany({
      where: { cepPrefixo: '09997', numero: '2' },
      data: { latitude: -23.6, longitude: -46.6, geoPrecisao: 'rooftop' },
    });
  });

  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it('grava e atualiza (upsert) quadras e lotes', async () => {
    expect(
      await repo.gravarQuadras([
        { setor: SETOR, quadra: '001', lat: -23.51, lng: -46.51 },
        { setor: SETOR, quadra: '002', lat: -23.52, lng: -46.52 },
      ]),
    ).toBe(2);
    await repo.gravarQuadras([{ setor: SETOR, quadra: '001', lat: -23.511, lng: -46.511 }]);
    expect((await prisma.geoQuadraFiscal.findUnique({ where: { setor_quadra: { setor: SETOR, quadra: '001' } } }))!.latitude).toBeCloseTo(-23.511);
    await repo.gravarLotes([
      { setor: SETOR, quadra: '001', lote: '0024', condominio: '00', ativo: true, lat: -23.5105, lng: -46.5105 },
      { setor: SETOR, quadra: '001', lote: '0000', condominio: '01', ativo: true, lat: -23.5106, lng: -46.5106 },
    ]);
    expect(await prisma.geoLoteFiscal.count({ where: { setor: SETOR } })).toBe(2);
  });

  it('setores do ITBI (todos e por importacao)', async () => {
    expect(await repo.setoresDoItbi()).toContain(SETOR);
    expect(await repo.setoresDoItbi(impB)).toEqual([SETOR]);
  });

  it('so a importacao pedida e localizada', async () => {
    const r = await repo.localizarSetor(SETOR, impB);
    expect(r).toEqual({ porLote: 0, porQuadra: 1 });
    const g4 = await prisma.itbiTransacao.findFirst({ where: { cepPrefixo: '09997', numero: '4' } });
    expect(g4).toMatchObject({ geoPrecisao: 'quadra', latitude: -23.52 });
    const g1 = await prisma.itbiTransacao.findFirst({ where: { cepPrefixo: '09997', numero: '1' } });
    expect(g1!.latitude).toBeNull();
  });

  it('lote exato, apartamento na quadra, rooftop preservado, quadra inexistente sem local', async () => {
    await repo.localizarSetor(SETOR);
    const por = async (n: number) => prisma.itbiTransacao.findFirst({ where: { cepPrefixo: '09997', numero: String(n) } });
    expect(await por(1)).toMatchObject({ geoPrecisao: 'lote', latitude: -23.5105 });
    expect(await por(2)).toMatchObject({ geoPrecisao: 'rooftop', latitude: -23.6 });
    expect(await por(3)).toMatchObject({ geoPrecisao: 'quadra', latitude: -23.511 });
    expect(await por(5)).toMatchObject({ geoPrecisao: null, latitude: null });
    // rodar de novo nao muda nada (idempotente)
    expect(await repo.localizarSetor(SETOR)).toEqual({ porLote: 0, porQuadra: 0 });
  });

  it('lote substitui rooftop (cadastro oficial vence o endereco)', async () => {
    await prisma.itbiTransacao.updateMany({
      where: { cepPrefixo: '09997', numero: '1' },
      data: { latitude: -23.7, longitude: -46.7, geoPrecisao: 'rooftop' },
    });
    const r = await repo.localizarSetor(SETOR);
    expect(r.porLote).toBe(1);
  });

  it('o job do Nominatim nao sobrescreve a localizacao pelo SQL', async () => {
    const n = await itbi.aplicarCoordenadas('r teste geosampa|1|09997000', { lat: -23.9, lng: -46.9, precisao: 'rua' });
    expect(n).toBe(0);
  });

  it('cobertura por precisao soma o total', async () => {
    const c = await repo.coberturaPorPrecisao();
    expect(c.total).toBe(c.lote + c.quadra + c.endereco + c.semLocal);
    expect(c.lote).toBeGreaterThanOrEqual(1);
  });
});
