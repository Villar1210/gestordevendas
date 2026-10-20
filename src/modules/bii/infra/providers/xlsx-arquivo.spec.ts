import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ArquivoXlsxInvalidoError, inspecionarZip, temAssinaturaZip } from './xlsx-arquivo';
import { escreverPlanilha, zipMinimo } from '../../../../../test/bii/xlsx-teste.helper';

describe('xlsx-arquivo - assinatura e diretorio central (anti zip-bomb/macro)', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bii-xlsx-spec-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('planilha valida do exceljs: assinatura PK e inspecao ok', async () => {
    const f = join(dir, 'ok.xlsx');
    await escreverPlanilha(f, [{ nome: 'JAN-2026', linhas: [['a'], [1]] }]);
    expect(await temAssinaturaZip(f)).toBe(true);
    const r = await inspecionarZip(f);
    expect(r.entradas).toBeGreaterThan(3);
  });

  it('arquivo que nao e ZIP (ex.: CSV renomeado)', async () => {
    const f = join(dir, 'csv.xlsx');
    writeFileSync(f, 'a;b;c\n1;2;3\n');
    expect(await temAssinaturaZip(f)).toBe(false);
    await expect(inspecionarZip(f)).rejects.toBeInstanceOf(ArquivoXlsxInvalidoError);
  });

  it('com macro (vbaProject.bin) -> recusado', async () => {
    const f = join(dir, 'macro.xlsx');
    writeFileSync(f, zipMinimo([{ nome: '[Content_Types].xml', dados: Buffer.from('<x/>') }, { nome: 'xl/vbaProject.bin', dados: Buffer.from('m') }]));
    await expect(inspecionarZip(f)).rejects.toThrow(/macros/);
  });

  it('razao de compressao suspeita (bomba) -> recusado', async () => {
    const f = join(dir, 'bomba.xlsx');
    const buf = zipMinimo([{ nome: 'xl/worksheets/sheet1.xml', dados: Buffer.from('x') }]);
    // declara 500 MB descompactados para 1 byte compactado (diretorio central)
    const offDir = buf.readUInt32LE(buf.length - 6);
    buf.writeUInt32LE(500 * 1024 * 1024, offDir + 24);
    writeFileSync(f, buf);
    await expect(inspecionarZip(f)).rejects.toThrow(/compressão suspeita/);
  });

  it('entrada criptografada -> recusada', async () => {
    const f = join(dir, 'senha.xlsx');
    const buf = zipMinimo([{ nome: 'a.xml', dados: Buffer.from('x') }]);
    const offDir = buf.readUInt32LE(buf.length - 6);
    buf.writeUInt16LE(1, offDir + 8);
    writeFileSync(f, buf);
    await expect(inspecionarZip(f)).rejects.toThrow(/senha/);
  });
});
