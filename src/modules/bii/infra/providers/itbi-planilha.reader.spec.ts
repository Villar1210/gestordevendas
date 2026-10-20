import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PlanilhaLimiteExcedidoError } from '../../domain/ports/itbi-planilha-reader.interface';
import { celulaParaValor, ExceljsItbiPlanilhaReader } from './itbi-planilha.reader';
import { escreverPlanilha } from '../../../../../test/bii/xlsx-teste.helper';

// atraso curto para apagar os temporarios truncados (o worker do jest sai
// antes dos 30 s padrao)
function novoLeitor(): ExceljsItbiPlanilhaReader {
  const r = new ExceljsItbiPlanilhaReader();
  r.atrasoApagarMs = 20;
  return r;
}

afterAll(() => new Promise((res) => setTimeout(res, 100)));

async function coletar(it: AsyncIterable<unknown>) {
  const saida: unknown[] = [];
  for await (const e of it) saida.push(e);
  return saida;
}

describe('ExceljsItbiPlanilhaReader', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bii-reader-spec-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('celulaParaValor: formula -> so o resultado guardado (nunca avalia); rich text; hyperlink; erro', () => {
    expect(celulaParaValor({ formula: 'A1*2', result: 10 })).toBe(10);
    expect(celulaParaValor({ formula: 'HYPERLINK("http://x")' })).toBeNull();
    expect(celulaParaValor({ sharedFormula: 'A1', result: 'ok' })).toBe('ok');
    expect(celulaParaValor({ richText: [{ text: 'R ' }, { text: 'X' }] })).toBe('R X');
    expect(celulaParaValor({ text: 'site', hyperlink: 'http://x' })).toBe('site');
    expect(celulaParaValor({ error: '#N/A' })).toBeNull();
    expect(celulaParaValor(undefined)).toBeNull();
  });

  it('le todas as abas em ordem, com o nome, e a formula como resultado', async () => {
    const f = join(dir, 'abas.xlsx');
    await escreverPlanilha(f, [
      { nome: 'JAN-2026', linhas: [['h1', 'h2'], [1, { formula: '1+1', result: 2 }]] },
      { nome: 'FEV-2026', linhas: [['x']] },
    ]);
    const eventos = await coletar(novoLeitor().ler(f, { maxLinhas: 100, maxBytes: 1e6 }));
    expect(eventos).toEqual([
      { tipo: 'aba', nome: 'JAN-2026' },
      { tipo: 'linha', valores: ['h1', 'h2'] },
      { tipo: 'linha', valores: [1, 2] },
      { tipo: 'aba', nome: 'FEV-2026' },
      { tipo: 'linha', valores: ['x'] },
    ]);
  });

  it('limite de linhas e de bytes lidos -> erro claro', async () => {
    const f = join(dir, 'grande.xlsx');
    await escreverPlanilha(f, [{ nome: 'A', linhas: Array.from({ length: 50 }, () => ['x'.repeat(100)]) }]);
    await expect(coletar(novoLeitor().ler(f, { maxLinhas: 10, maxBytes: 1e9 }))).rejects.toBeInstanceOf(
      PlanilhaLimiteExcedidoError,
    );
    await expect(coletar(novoLeitor().ler(f, { maxLinhas: 1e6, maxBytes: 1000 }))).rejects.toThrow(/MB de dados/);
  });

  it('cancelamento (signal) interrompe a leitura', async () => {
    const f = join(dir, 'cancel.xlsx');
    await escreverPlanilha(f, [{ nome: 'A', linhas: [['a'], ['b']] }]);
    const c = new AbortController();
    c.abort(new Error('desligamento'));
    await expect(coletar(novoLeitor().ler(f, { maxLinhas: 10, maxBytes: 1e6 }, c.signal))).rejects.toThrow('desligamento');
  });
});

describe('ExceljsItbiPlanilhaReader - temporarios do exceljs apagados (M1)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require('fs');
  let dir: string;
  let planilha: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'bii-reader-tmp-'));
    planilha = join(dir, 'p.xlsx');
    // exceljs grava a aba ANTES do sharedStrings -> o leitor usa temporario
    await escreverPlanilha(planilha, [
      { nome: 'A', linhas: Array.from({ length: 20 }, (_, i) => [`linha ${i}`, i]) },
      { nome: 'B', linhas: [['x']] },
      { nome: 'C', linhas: [['y']] },
    ]);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('leitura completa: temporarios registrados e apagados; conteudo de todas as abas lido', async () => {
    const r = novoLeitor();
    const eventos = await coletar(r.ler(planilha, { maxLinhas: 1000, maxBytes: 1e6 }));
    expect(eventos.filter((e) => (e as { tipo: string }).tipo === 'aba')).toHaveLength(3);
    expect(r.ultimosTemporarios.length).toBeGreaterThanOrEqual(3);
    for (const t of r.ultimosTemporarios) expect(existsSync(t)).toBe(false);
  });

  const esvaziadosEApagados = async (r: ExceljsItbiPlanilhaReader) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { statSync } = require('fs');
    expect(r.ultimosTemporarios.length).toBeGreaterThanOrEqual(3);
    for (const t of r.ultimosTemporarios) if (existsSync(t)) expect(statSync(t).size).toBe(0); // truncado na hora
    await new Promise((res) => setTimeout(res, 80));
    for (const t of r.ultimosTemporarios) expect(existsSync(t)).toBe(false); // apagado depois
  };

  it('abort no meio: temporarios das abas ainda nao lidas tambem sao esvaziados e apagados', async () => {
    const r = novoLeitor();
    r.atrasoApagarMs = 50;
    const c = new AbortController();
    const it = r.ler(planilha, { maxLinhas: 1000, maxBytes: 1e6 }, c.signal)[Symbol.asyncIterator]();
    await it.next();
    await it.next();
    c.abort(new Error('desligamento'));
    await expect(it.next()).rejects.toThrow('desligamento');
    await esvaziadosEApagados(r);
  });

  it('consumidor para no meio (break -> return()): temporarios esvaziados e apagados', async () => {
    const r = novoLeitor();
    r.atrasoApagarMs = 50;
    for await (const e of r.ler(planilha, { maxLinhas: 1000, maxBytes: 1e6 })) {
      if ((e as { tipo: string }).tipo === 'linha') break;
    }
    await esvaziadosEApagados(r);
  });

  it('abort LOGO na 1a aba (ReadStream do exceljs ainda nao aberto) nao gera ENOENT sem ouvinte', async () => {
    const naoTratadas: unknown[] = [];
    const ouvinte = (e: unknown) => naoTratadas.push(e);
    process.on('uncaughtException', ouvinte);
    try {
      const r = novoLeitor();
      r.atrasoApagarMs = 50;
      const c = new AbortController();
      c.abort(new Error('ja abortado'));
      await expect(coletar(r.ler(planilha, { maxLinhas: 1000, maxBytes: 1e6 }, c.signal))).rejects.toThrow('ja abortado');
      await new Promise((res) => setTimeout(res, 150));
      expect(naoTratadas).toEqual([]);
      for (const t of r.ultimosTemporarios) expect(existsSync(t)).toBe(false);
    } finally {
      process.off('uncaughtException', ouvinte);
    }
  });

  it('registro escopado: tmp.file fora da leitura nao e registrado nem alterado', async () => {
    const { comRegistroDeTemporarios } = await import('./exceljs-tmp');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tmpMod = require(require.resolve('tmp', { paths: [require('path').dirname(require.resolve('exceljs/package.json'))] }));
    const criar = () => new Promise<string>((res, rej) => tmpMod.file((e: Error | null, p: string, _fd: number, limpar: () => void) => (e ? rej(e) : (limpar(), res(p)))));
    const registrados = new Set<string>();
    comRegistroDeTemporarios(registrados, () => undefined); // instala
    const fora = await criar();
    expect(registrados.size).toBe(0);
    const dentro = await comRegistroDeTemporarios(registrados, () => criar());
    expect([...registrados]).toEqual([dentro]);
    expect(require('path').dirname(fora)).toBe(require('path').dirname(dentro)); // mesma pasta (opcoes intactas)
  });
});
