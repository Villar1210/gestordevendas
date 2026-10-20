// Importador do ITBI (integracao - Postgres REAL + exceljs REAL) com planilhas
// SINTETICAS geradas no teste. Cobre: cabecalhos com acento/caixa, coluna
// extra pessoal ("Nome do comprador") que NAO pode entrar, linha duplicada
// (na mesma aba e entre abas), linha sem valor (descartada), linhas vazias
// (nao contam), linha com 27 colunas, aba de apoio com linhas vazias, aba sem
// cabecalho reconhecivel, FEV-2026 "pardao", 2022 "ACC (IPTU)" repetido, 2024
// aba mensal sem cabecalho, idempotencia e "uma por vez".
// Sem DATABASE_URL o teste e pulado. Comando:
//   DATABASE_URL=postgresql://... npx jest src/modules/bii --runInBand
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { ExceljsItbiPlanilhaReader } from '../../infra/providers/itbi-planilha.reader';
import { PrismaItbiRepository } from '../../infra/database/prisma-itbi.repository';
import { PrismaItbiImportacaoRepository } from '../../infra/database/prisma-itbi-importacao.repository';
import { ImportadorItbiService } from './importador-itbi.service';
import { CABECALHO_REAL, escreverPlanilha } from '../../../../../test/bii/xlsx-teste.helper';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;
const LOGRADOURO = 'R TESTE BII SINTETICO';
const USER = '00000000-0000-4000-8000-000000000001';

// linha no formato do arquivo real (28 colunas)
function linha(n: number, extra: Partial<Record<number, unknown>> = {}): unknown[] {
  const l: unknown[] = [
    12318300100 + n, `${LOGRADOURO} ${n}`, n, `AP ${n}`, 'VILA EMA', 'COND TESTE', 3277000, '1.Compra e venda',
    300000 + n, 46009, 250000, 100, 250000, 300000, '2.Minha Casa Minha Vida', 200000, '9º Cartório', 777000 + n,
    'Ativo Predial', 500, 9.9, 0.01, 50, 20, 'APARTAMENTO EM CONDOMÍNIO', 13, 'RESIDENCIAL VERTICAL', 2015,
  ];
  for (const [i, v] of Object.entries(extra)) l[Number(i)] = v;
  return l;
}

descrever('ImportadorItbiService (integracao - banco real, planilha sintetica)', () => {
  let prisma: PrismaService;
  let importacoes: PrismaItbiImportacaoRepository;
  let svc: ImportadorItbiService;
  let dir: string;
  const ids: string[] = [];

  const limpar = async () => {
    await prisma.itbiTransacao.deleteMany({ where: { logradouro: { startsWith: LOGRADOURO } } });
    await prisma.itbiImportacao.deleteMany({ where: { importadoPorUserId: USER } });
  };

  async function importar(nome: string, abas: { nome: string; linhas: unknown[][] }[]) {
    const caminho = join(dir, nome);
    await escreverPlanilha(caminho, abas);
    const { importacaoId } = await svc.iniciar({ caminho, nomeArquivo: nome, ano: 2026, userId: USER });
    ids.push(importacaoId);
    await svc.aguardar();
    expect(existsSync(caminho)).toBe(false); // temporario sempre apagado
    const reg = (await importacoes.listar(50)).find((i) => i.id === importacaoId)!;
    return reg;
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = new PrismaService();
    await prisma.$connect();
    importacoes = new PrismaItbiImportacaoRepository(prisma);
    svc = new ImportadorItbiService(new ExceljsItbiPlanilhaReader(), new PrismaItbiRepository(prisma), importacoes);
    dir = mkdtempSync(join(tmpdir(), 'bii-import-spec-'));
    await limpar();
  });

  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('planilha com 2 abas mensais, apoio, aba estranha, duplicadas, descarte e coluna pessoal', async () => {
    const reg = await importar('base.xlsx', [
      {
        nome: 'JAN-2026',
        linhas: [
          [...CABECALHO_REAL, 'Nome do comprador'],
          [...linha(1), 'FULANO DE TAL'],
          [...linha(2), 'BELTRANA'],
          [],
          [...linha(1), 'FULANO DE TAL'], // duplicada na mesma aba
          [...linha(3, { 8: null }), 'SICRANO'], // sem valor -> descartada
          linha(4).slice(0, 27), // 27 colunas (ultima vazia)
        ],
      },
      {
        nome: 'FEV-2026',
        linhas: [
          CABECALHO_REAL.map((c, i) => (i === 26 ? 'Descrição do pardão (IPTU)' : c.toUpperCase())),
          linha(5),
          linha(1), // duplicada entre abas (mesmos dados da JAN, sem a coluna extra)
        ],
      },
      { nome: 'LEGENDA', linhas: [['Dados pessoais retirados'], ...Array.from({ length: 30 }, () => [null])] },
      { nome: 'Planilha Estranha', linhas: [['coluna a', 'coluna b'], [1, 2]] },
    ]);
    expect(reg).toMatchObject({ status: 'concluida', linhasLidas: 7, linhasInseridas: 4, linhasDuplicadas: 2, linhasDescartadas: 1, mensagemErro: null });
    expect(reg.abas).toEqual([
      { nome: 'JAN-2026', status: 'importada', linhas: 5 },
      { nome: 'FEV-2026', status: 'importada', linhas: 2 },
      { nome: 'LEGENDA', status: 'ignorada', motivo: 'aba de apoio (não é transação)', linhas: 0 },
      { nome: 'Planilha Estranha', status: 'ignorada', motivo: 'cabeçalho não reconhecido', linhas: 0 },
    ]);

    const rows = await prisma.itbiTransacao.findMany({ where: { importacaoId: reg.id }, orderBy: { logradouro: 'asc' } });
    expect(rows.map((r) => r.logradouro)).toEqual([`${LOGRADOURO} 1`, `${LOGRADOURO} 2`, `${LOGRADOURO} 4`, `${LOGRADOURO} 5`]);
    // coluna pessoal e colunas fora do mapa nunca chegam ao banco
    const tudo = JSON.stringify(rows);
    expect(tudo).not.toMatch(/FULANO|BELTRANA|SICRANO|Cartório|777001/);
    const r1 = rows[0];
    expect(r1).toMatchObject({
      sqlCadastro: '12318300101',
      numero: '1',
      cep: '03277000',
      cepPrefixo: '03277',
      bairroNormalizado: 'vila ema',
      enderecoChave: `rua teste bii sintetico 1|1|03277000`,
      naturezaCodigo: 1,
      naturezaTransacao: 'Compra e venda',
      tipoFinanciamentoCodigo: 2,
      situacaoSql: 'Ativo Predial',
      usoIptu: 20,
      padraoIptu: 13,
      padraoDescricao: 'RESIDENCIAL VERTICAL',
      accIptu: 2015,
      latitude: null,
      arquivoAba: 'JAN-2026',
    });
    expect(Number(r1.valorTransacao)).toBe(300001);
    expect(Number(r1.areaConstruida)).toBe(50);
    expect(Number(r1.fracaoIdeal)).toBe(0.01);
    expect(r1.dataTransacao.toISOString()).toBe('2025-12-18T00:00:00.000Z');
    expect(r1.hashLinha).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[2].accIptu).toBeNull(); // linha de 27 colunas
    expect(rows[3].padraoDescricao).toBe('RESIDENCIAL VERTICAL'); // FEV "pardao"
  });

  it('reimportar o mesmo arquivo nao duplica (hashLinha)', async () => {
    const reg = await importar('base-de-novo.xlsx', [{ nome: 'JAN-2026', linhas: [CABECALHO_REAL, linha(1), linha(2)] }]);
    expect(reg).toMatchObject({ status: 'concluida', linhasLidas: 2, linhasInseridas: 0, linhasDuplicadas: 2 });
  });

  it('2022: "ACC (IPTU)" repetido na coluna 27 -> descricao do padrao pela posicao', async () => {
    const cab = [...CABECALHO_REAL];
    cab[26] = 'ACC (IPTU)';
    const reg = await importar('2022.xlsx', [{ nome: 'JAN-2022', linhas: [cab, linha(22, { 26: 'RESIDENCIAL HORIZONTAL', 27: 1990 })] }]);
    expect(reg).toMatchObject({ status: 'concluida', linhasInseridas: 1 });
    const r = await prisma.itbiTransacao.findFirstOrThrow({ where: { importacaoId: reg.id } });
    expect(r.padraoDescricao).toBe('RESIDENCIAL HORIZONTAL');
    expect(r.accIptu).toBe(1990);
  });

  it('2024: aba mensal sem cabecalho (1a linha ja e dado) usa a ordem padrao; apoio com linhas vazias nao conta', async () => {
    const reg = await importar('2024.xlsx', [
      { nome: 'JAN-2024', linhas: [linha(241), linha(242)] },
      { nome: 'FEV-2024', linhas: [CABECALHO_REAL, linha(243)] },
      { nome: 'Tabela de USOS', linhas: [['Código', 'Descrição'], [0, 'TERRENO'], ...Array.from({ length: 1000 }, () => [null, null])] },
      { nome: 'Rascunho', linhas: [linha(244)] }, // nao e MMM-AAAA: sem cabecalho -> ignorada
    ]);
    expect(reg).toMatchObject({ status: 'concluida', linhasLidas: 3, linhasInseridas: 3, linhasDescartadas: 0, linhasDuplicadas: 0 });
    expect(reg.abas.map((a) => [a.nome, a.status, a.linhas])).toEqual([
      ['JAN-2024', 'importada', 2],
      ['FEV-2024', 'importada', 1],
      ['Tabela de USOS', 'ignorada', 0],
      ['Rascunho', 'ignorada', 0],
    ]);
    expect(reg.abas[0].motivo).toBe('sem cabeçalho: ordem padrão das colunas');
  });

  it('nenhuma aba valida -> status erro com mensagem clara', async () => {
    const reg = await importar('vazia.xlsx', [{ nome: 'Planilha1', linhas: [['a', 'b'], [1, 2]] }]);
    expect(reg.status).toBe('erro');
    expect(reg.mensagemErro).toMatch(/Nenhuma aba/);
  });

  it('arquivo corrompido -> status erro generico (sem detalhe interno) e temporario apagado', async () => {
    const caminho = join(dir, 'corrompido.xlsx');
    require('fs').writeFileSync(caminho, 'PK\x03\x04 lixo');
    const { importacaoId } = await svc.iniciar({ caminho, nomeArquivo: 'c.xlsx', ano: 2026, userId: USER });
    ids.push(importacaoId);
    await svc.aguardar();
    expect(existsSync(caminho)).toBe(false);
    const reg = (await importacoes.listar(50)).find((i) => i.id === importacaoId)!;
    expect(reg.status).toBe('erro');
    expect(reg.mensagemErro).toBe('Não foi possível ler a planilha. Confira se é o arquivo .xlsx do ITBI.');
  });

  it('uma por vez: outra "processando" recente -> 409 e o arquivo e apagado; abandonada (>30 min) -> liberada', async () => {
    const preso = await importacoes.criar({ nomeArquivo: 'preso.xlsx', ano: 2026, importadoPorUserId: USER });
    const caminho = join(dir, 'segunda.xlsx');
    await escreverPlanilha(caminho, [{ nome: 'JAN-2026', linhas: [CABECALHO_REAL, linha(9)] }]);
    await expect(svc.iniciar({ caminho, nomeArquivo: 's.xlsx', ano: 2026, userId: USER })).rejects.toBeInstanceOf(ConflictException);
    expect(existsSync(caminho)).toBe(false);

    svc.agora = () => new Date(Date.now() + 31 * 60 * 1000);
    const reg = await importar('terceira.xlsx', [{ nome: 'JAN-2026', linhas: [CABECALHO_REAL, linha(10)] }]);
    svc.agora = () => new Date();
    expect(reg.status).toBe('concluida');
    const antigo = (await importacoes.listar(50)).find((i) => i.id === preso.id)!;
    expect(antigo.status).toBe('erro');
    expect(antigo.mensagemErro).toMatch(/interrompida/i);
  });

  it('B4: onModuleInit marca as "processando" (do processo anterior) como erro', async () => {
    const presa = await importacoes.criar({ nomeArquivo: 'presa.xlsx', ano: 2026, importadoPorUserId: USER });
    await svc.onModuleInit();
    const r = (await importacoes.listar(50)).find((i) => i.id === presa.id)!;
    expect(r).toMatchObject({ status: 'erro', mensagemErro: 'Interrompida por reinício do servidor' });
    expect(r.concluidoEm).not.toBeNull();
  });
});
