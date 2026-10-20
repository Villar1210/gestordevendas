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

describe('xlsx-arquivo - descompactacao REAL (M1)', () => {
  let dir: string;
  const MB = 1024 * 1024;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bii-xlsx-real-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('ZIP forjado: tamanho declarado pequeno, conteudo real grande -> recusado pelo total real', async () => {
    const f = join(dir, 'forjado.xlsx');
    // 8 MB de zeros comprimem para ~8 KB; declara 100 bytes (passa nas
    // conferencias de tamanho declarado e de razao)
    writeFileSync(f, zipMinimo([{ nome: 'xl/worksheets/sheet1.xml', dados: Buffer.alloc(8 * MB), deflate: true, declararDescompactado: 100 }]));
    await expect(inspecionarZip(f)).resolves.toMatchObject({ descompactadoDeclarado: 100, descompactadoReal: 8 * MB });
    await expect(inspecionarZip(f, { total: 4 * MB, sharedStrings: 300 * MB })).rejects.toThrow(/descompactada passa de/);
  });

  it('xl/sharedStrings.xml acima do limite proprio -> recusado (mesmo com o total ok)', async () => {
    const f = join(dir, 'strings.xlsx');
    writeFileSync(f, zipMinimo([{ nome: 'xl/sharedStrings.xml', dados: Buffer.alloc(3 * MB, 'a'), deflate: true, declararDescompactado: 10 }]));
    await expect(inspecionarZip(f, { total: 100 * MB, sharedStrings: 2 * MB })).rejects.toThrow(/texto demais/);
  });

  it('dado escondido fora do diretorio central (entrada nao contigua) -> recusado', async () => {
    const f = join(dir, 'escondido.xlsx');
    writeFileSync(f, zipMinimo([{ nome: 'a.xml', dados: Buffer.from('x'), deflate: true }], { lixoAntes: Buffer.from('PK\x03\x04 entrada fantasma') }));
    await expect(inspecionarZip(f)).rejects.toThrow(/não é uma planilha/);
  });

  it('deflate corrompido -> recusado com mensagem generica', async () => {
    const f = join(dir, 'corrompido.xlsx');
    const buf = zipMinimo([{ nome: 'a.xml', dados: Buffer.alloc(1000, 'b'), deflate: true }]);
    buf.fill(0xff, 31 + 'a.xml'.length, 40 + 'a.xml'.length);
    writeFileSync(f, buf);
    await expect(inspecionarZip(f)).rejects.toThrow(/não é uma planilha/);
  });

  it('planilha real do exceljs: real == declarado, dentro dos limites padrao', async () => {
    const f = join(dir, 'ok.xlsx');
    await escreverPlanilha(f, [{ nome: 'JAN-2026', linhas: [['a', 'b'], [1, 'texto']] }]);
    const r = await inspecionarZip(f);
    expect(r.descompactadoReal).toBe(r.descompactadoDeclarado);
  });
});
