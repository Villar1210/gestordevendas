import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PlanilhaLimiteExcedidoError } from '../../domain/ports/itbi-planilha-reader.interface';
import { celulaParaValor, ExceljsItbiPlanilhaReader } from './itbi-planilha.reader';
import { escreverPlanilha } from '../../../../../test/bii/xlsx-teste.helper';

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
    const eventos = await coletar(new ExceljsItbiPlanilhaReader().ler(f, { maxLinhas: 100, maxBytes: 1e6 }));
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
    await expect(coletar(new ExceljsItbiPlanilhaReader().ler(f, { maxLinhas: 10, maxBytes: 1e9 }))).rejects.toBeInstanceOf(
      PlanilhaLimiteExcedidoError,
    );
    await expect(coletar(new ExceljsItbiPlanilhaReader().ler(f, { maxLinhas: 1e6, maxBytes: 1000 }))).rejects.toThrow(/MB de dados/);
  });

  it('cancelamento (signal) interrompe a leitura', async () => {
    const f = join(dir, 'cancel.xlsx');
    await escreverPlanilha(f, [{ nome: 'A', linhas: [['a'], ['b']] }]);
    const c = new AbortController();
    c.abort(new Error('desligamento'));
    await expect(coletar(new ExceljsItbiPlanilhaReader().ler(f, { maxLinhas: 10, maxBytes: 1e6 }, c.signal))).rejects.toThrow('desligamento');
  });
});
