// Teste de INTEGRACAO das implementacoes de infra do modulo Ferramentas
// PDF, sem mocks: gera PDFs com pdf-lib em memoria e exercita o motor
// pdf-lib, o ZIP escrito a mao, qpdf, Ghostscript, LibreOffice, o
// rasterizador e o extrator de texto de verdade. Testes que dependem de
// binario externo pulam sozinhos se o binario nao existir na maquina.
import { execFileSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PdfLibEngineService } from './pdf-lib-engine.service';
import { StoreZipBuilderService, crc32 } from './store-zip-builder.service';
import { QpdfSecurityService } from './qpdf-security.service';
import { GhostscriptCompressorService } from './ghostscript-compressor.service';
import { LibreOfficeOfficeConverterService } from './libreoffice-office-converter.service';
import { BinaryAvailabilityService } from './binary-availability.service';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { detectFileKind } from '../../domain/file-signature';

jest.setTimeout(180_000);

// pdf-parse (pdfjs) carrega o proprio worker com import() dinamico, o que a
// VM do jest bloqueia sem --experimental-vm-modules. Por isso tudo que usa
// pdf-parse (extrator, rasterizador e a verificacao de texto dos PDFs
// gerados) roda num processo Node DE VERDADE (ts-node transpile-only), com
// os mesmos servicos de producao - sem mock.
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SERVICES_DIR = __dirname;

function runInNode<T>(script: string, args: string[] = []): T {
  const out = execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', script, '--', ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, TS_NODE_PROJECT: path.join(REPO_ROOT, 'tsconfig.json') },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  }).toString();
  const line = out.trim().split('\n').pop()!;
  return JSON.parse(line) as T;
}

let fileSeq = 0;
async function writeTmp(data: Buffer, ext = 'pdf'): Promise<string> {
  const file = path.join(tmpDir, `in-${++fileSeq}.${ext}`);
  await fs.writeFile(file, data);
  return file;
}

function hasBinary(cmd: string, args = ['--version']): boolean {
  try {
    return spawnSync(cmd, args, { timeout: 60_000, stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

const HAS_QPDF = hasBinary(process.env.QPDF_PATH || 'qpdf');
const HAS_GS = hasBinary(process.env.GHOSTSCRIPT_PATH || 'gs');
const HAS_SOFFICE = hasBinary(process.env.LIBREOFFICE_PATH || 'soffice', ['--headless', '--version']);
const HAS_UNZIP = hasBinary('unzip', ['-v']);
const itIf = (cond: boolean) => (cond ? it : it.skip);

const ACENTOS = 'Ação São João ç';

/** PDF de teste: N paginas, cada uma com "Pagina N" e o texto acentuado. */
async function makePdf(pages: number, size: [number, number] = [300, 400]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage(size);
    page.drawText(`Pagina ${i}`, { x: 30, y: size[1] - 60, size: 20, font });
    page.drawText(ACENTOS, { x: 30, y: size[1] - 100, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

/** PDF "pesado": imagem JPEG grande de alta qualidade (Ghostscript reduz). */
async function makeHeavyPdf(): Promise<Buffer> {
  const canvas = createCanvas(1600, 1600);
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 1600; y += 4) {
    for (let x = 0; x < 1600; x += 4) {
      ctx.fillStyle = `rgb(${(x * 7 + y) % 256},${(y * 3) % 256},${(x ^ y) % 256})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }
  const jpg = await canvas.encode('jpeg', 100);
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(jpg);
  doc.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  return Buffer.from(await doc.save());
}

/** Texto de cada pagina, via PdfParseTextExtractorService num Node real. */
async function textOf(pdf: Buffer): Promise<string[]> {
  const file = await writeTmp(pdf);
  const result = runInNode<{ byPage: { text: string }[] }>(
    `const { PdfParseTextExtractorService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-parse-text-extractor.service'))});
     const fs = require('fs');
     new PdfParseTextExtractorService().extract(fs.readFileSync(process.argv[process.argv.length - 1]))
       .then((r) => console.log(JSON.stringify(r)))
       .catch((e) => { console.log(JSON.stringify({ error: e.code || e.message })); process.exitCode = 1; });`,
    [file],
  );
  return result.byPage.map((p) => p.text);
}

/** Rasteriza via PdfParseRasterizerService num Node real; devolve as imagens. */
async function rasterize(pdf: Buffer, indices: number[], options: { format: 'jpg' | 'png'; dpi: 72 | 150 | 300 }) {
  const file = await writeTmp(pdf);
  const pages = runInNode<{ page: number; data: string }[]>(
    `const { PdfParseRasterizerService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-parse-rasterizer.service'))});
     const fs = require('fs');
     new PdfParseRasterizerService().render(fs.readFileSync(process.argv[process.argv.length - 1]), ${JSON.stringify(indices)}, ${JSON.stringify(options)})
       .then((r) => console.log(JSON.stringify(r.map((p) => ({ page: p.page, data: p.data.toString('base64') })))))
       .catch((e) => { console.log(JSON.stringify({ error: e.code || e.message })); process.exitCode = 1; });`,
    [file],
  );
  return pages.map((p) => ({ page: p.page, data: Buffer.from(p.data, 'base64') }));
}

async function load(pdf: Buffer): Promise<PDFDocument> {
  return PDFDocument.load(pdf);
}

/** Le o central directory de um ZIP (independente do unzip). */
function readZipCentralDirectory(zip: Buffer): { name: string; size: number; crc: number; offset: number }[] {
  const eocd = zip.length - 22;
  expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(p + 16);
    const size = zip.readUInt32LE(p + 24);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const offset = zip.readUInt32LE(p + 42);
    entries.push({ name: zip.subarray(p + 46, p + 46 + nameLen).toString('utf8'), size, crc, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extractZipEntry(zip: Buffer, entry: { offset: number; size: number }): Buffer {
  expect(zip.readUInt32LE(entry.offset)).toBe(0x04034b50);
  const nameLen = zip.readUInt16LE(entry.offset + 26);
  const extraLen = zip.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLen + extraLen;
  return zip.subarray(start, start + entry.size);
}

let tmpDir: string;
beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdftools-it-'));
});
afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
describe('PdfLibEngineService (pdf-lib real)', () => {
  const engine = new PdfLibEngineService();

  it('getPageCount + PDF corrompido -> INVALID_INPUT', async () => {
    expect(await engine.getPageCount(await makePdf(3))).toBe(3);
    await expect(engine.getPageCount(Buffer.from('%PDF-1.7 lixo'))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('merge preserva a ordem enviada', async () => {
    const merged = await engine.merge([await makePdf(2), await makePdf(3)]);
    const texts = await textOf(merged);
    expect(texts).toHaveLength(5);
    expect(texts.map((t) => t.match(/Pagina (\d+)/)![1])).toEqual(['1', '2', '1', '2', '3']);
    expect(texts[0]).toContain(ACENTOS);
  });

  it('extractPages e splitGroups', async () => {
    const src = await makePdf(6);
    const extracted = await engine.extractPages(src, [4, 0]);
    expect((await textOf(extracted)).map((t) => t.match(/Pagina (\d+)/)![1])).toEqual(['5', '1']);

    const parts = await engine.splitGroups(src, [[0, 1, 2], [3], [4, 5]]);
    expect(parts).toHaveLength(3);
    expect(await Promise.all(parts.map(async (p) => (await load(p)).getPageCount()))).toEqual([3, 1, 2]);
  });

  it('organize reordena, remove e gira (somando a rotacao existente)', async () => {
    const doc = await PDFDocument.load(await makePdf(3));
    doc.getPage(2).setRotation(degrees(90));
    const src = Buffer.from(await doc.save());
    const out = await engine.organize(src, [
      { index: 2, rotate: 270 },
      { index: 0, rotate: 90 },
    ]);
    const result = await load(out);
    expect(result.getPageCount()).toBe(2);
    expect(result.getPage(0).getRotation().angle).toBe(0); // 90 + 270 = 360 -> 0
    expect(result.getPage(1).getRotation().angle).toBe(90);
    expect((await textOf(out))[0]).toContain('Pagina 3');
  });

  it('rotate: todas ou so as escolhidas', async () => {
    const src = await makePdf(3);
    const all = await load(await engine.rotate(src, 180, null));
    expect(all.getPages().map((p) => p.getRotation().angle)).toEqual([180, 180, 180]);
    const some = await load(await engine.rotate(src, 270, [1]));
    expect(some.getPages().map((p) => p.getRotation().angle)).toEqual([0, 270, 0]);
  });

  it('page-numbers: formatos, startAt e skipFirst (inclusive em pagina girada)', async () => {
    const doc = await PDFDocument.load(await makePdf(3));
    doc.getPage(1).setRotation(degrees(90));
    const src = Buffer.from(await doc.save());
    const out = await engine.addPageNumbers(src, { position: 'inferior-direita', format: 'n-de-total', startAt: 5, skipFirst: true });
    const texts = await textOf(out);
    expect(texts[0]).not.toMatch(/\d+ de \d+/);
    expect(texts[1]).toContain('5 de 6');
    expect(texts[2]).toContain('6 de 6');

    const out2 = await engine.addPageNumbers(await makePdf(2), { position: 'superior-direita', format: 'pagina-n', startAt: 1, skipFirst: false });
    expect((await textOf(out2))[1]).toContain('Página 2');
  });

  it('watermark com acentos e emoji (emoji vira "?")', async () => {
    const out = await engine.addWatermark(await makePdf(2), {
      text: `${ACENTOS} 😀`,
      opacity: 0.3,
      size: 'grande',
      diagonal: true,
    });
    const texts = await textOf(out);
    expect(texts).toHaveLength(2);
    expect(texts[0].replace(/\s+/g, ' ')).toContain('Ação São João ç ?');
  });

  it('imagesToPdf: A4 auto (paisagem para imagem larga) e "ajustar"', async () => {
    const canvas = createCanvas(400, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, 400, 200);
    const png = await canvas.encode('png');
    const jpg = await canvas.encode('jpeg', 80);

    const a4 = await load(await engine.imagesToPdf([{ buffer: jpg, kind: 'jpg' }, { buffer: png, kind: 'png' }], { pageSize: 'A4', orientation: 'auto', margin: 'pequena' }));
    expect(a4.getPageCount()).toBe(2);
    const { width, height } = a4.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);

    const fit = await load(await engine.imagesToPdf([{ buffer: png, kind: 'png' }], { pageSize: 'ajustar', orientation: 'auto', margin: 'nenhuma' }));
    expect(fit.getPage(0).getSize()).toEqual({ width: 400, height: 200 });

    await expect(
      engine.imagesToPdf([{ buffer: Buffer.from([0xff, 0xd8, 0xff, 0, 1, 2]), kind: 'jpg' }], { pageSize: 'A4', orientation: 'auto', margin: 'nenhuma' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('imagesToPdf: PNG forjado (20000x20000 em poucos bytes) e recusado antes do embed', async () => {
    const forged = Buffer.alloc(57);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(forged, 0);
    forged.writeUInt32BE(13, 8);
    forged.write('IHDR', 12, 'latin1');
    forged.writeUInt32BE(20000, 16);
    forged.writeUInt32BE(20000, 20);
    forged[24] = 8; // profundidade
    forged[25] = 6; // RGBA
    await expect(
      engine.imagesToPdf([{ buffer: forged, kind: 'png' }], { pageSize: 'A4', orientation: 'auto', margin: 'nenhuma' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'A imagem nº 1 tem resolução alta demais (máx. ~30 megapixels).' });
  });

  it('createTextPdf: titulo, ##, lista, acentos, emoji, paginacao e rodape', async () => {
    const paragraphs = Array.from({ length: 80 }, (_, i) => `Parágrafo ${i + 1}: ${ACENTOS} — texto longo que precisa quebrar automaticamente pela largura da página para caber.`);
    const content = ['# Capítulo 1', '## Seção', '- item com ção', '- item 2 😀', '', ...paragraphs, 'palavraenormesemespacos'.repeat(10)].join('\n');
    const { pdf, pages } = await engine.createTextPdf({ title: `Relatório ${ACENTOS}`, content, pageSize: 'A4', fontSize: 12 });
    expect(pages).toBeGreaterThan(1);
    const doc = await load(pdf);
    expect(doc.getPageCount()).toBe(pages);
    const texts = await textOf(pdf);
    expect(texts[0]).toContain(`Relatório ${ACENTOS}`);
    expect(texts[0]).toContain('Capítulo 1');
    expect(texts[0]).toContain('item 2 ?');
    expect(texts[0]).toContain(`Página 1 de ${pages}`);
    expect(texts[pages - 1]).toContain(`Página ${pages} de ${pages}`);
    expect(texts[1]).toContain(`Relatório ${ACENTOS}`); // cabecalho a partir da 2a pagina
  });

  it('PDF protegido -> ENCRYPTED_PDF com a mensagem padrao (via qpdf)', async () => {
    if (!HAS_QPDF) return;
    const enc = await new QpdfSecurityService().protect(await makePdf(1), { password: 'abcd', allowPrint: true, allowCopy: false });
    await expect(engine.getPageCount(enc)).rejects.toMatchObject({
      code: 'ENCRYPTED_PDF',
      message: expect.stringContaining('Desbloquear PDF'),
    });
  });
});

// ---------------------------------------------------------------------------
describe('StoreZipBuilderService (ZIP STORE + CRC32 manual)', () => {
  const zipBuilder = new StoreZipBuilderService();

  it('CRC32 confere com o valor de referencia', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it('central directory valido, conteudo integro e nomes UTF-8 sem caminho', async () => {
    const a = await makePdf(1);
    const b = Buffer.from('conteúdo ção');
    const zip = zipBuilder.build([
      { name: 'contrato_pagina_1.pdf', data: a },
      { name: '../São João/ç.txt', data: b },
    ]);
    const entries = readZipCentralDirectory(zip);
    expect(entries.map((e) => e.name)).toEqual(['contrato_pagina_1.pdf', '_São João_ç.txt']);
    expect(extractZipEntry(zip, entries[0]).equals(a)).toBe(true);
    expect(extractZipEntry(zip, entries[1]).equals(b)).toBe(true);
    expect(entries[0].crc).toBe(crc32(a));
  });

  itIf(HAS_UNZIP)('unzip -t aceita o arquivo', async () => {
    const zip = zipBuilder.build([
      { name: 'a.pdf', data: await makePdf(2) },
      { name: 'b.pdf', data: await makePdf(1) },
    ]);
    const file = path.join(tmpDir, 'teste.zip');
    await fs.writeFile(file, zip);
    const out = execFileSync('unzip', ['-t', file]).toString();
    expect(out).toMatch(/No errors detected/);
  });

  it('rejeita lista vazia', () => {
    expect(() => zipBuilder.build([])).toThrow(PdfToolsError);
  });

  it('pasta: exatamente UM nivel, sanitizada (sem traversal vindo do nome ou da pasta)', () => {
    const zip = zipBuilder.build([
      { name: 'a_pagina_1.jpg', data: Buffer.from('a'), folder: 'contrato (2)' },
      { name: '../../etc/passwd', data: Buffer.from('b'), folder: '../../x/y' },
      { name: 'c.jpg', data: Buffer.from('c'), folder: '..' },
      { name: 'd.jpg', data: Buffer.from('d') },
    ]);
    const names = readZipCentralDirectory(zip).map((e) => e.name);
    expect(names).toEqual(['contrato (2)/a_pagina_1.jpg', '_.._x_y/_.._etc_passwd', 'pasta/c.jpg', 'd.jpg']);
    for (const n of names) {
      expect(n.split('/').length).toBeLessThanOrEqual(2);
      expect(n.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
describe('QpdfSecurityService (qpdf real)', () => {
  const security = new QpdfSecurityService();

  itIf(HAS_QPDF)('protect (AES-256) -> unlock devolve o PDF legivel', async () => {
    const src = await makePdf(2);
    const enc = await security.protect(src, { password: 'Senh@ São 123', allowPrint: false, allowCopy: false });
    expect(detectFileKind(enc)).toBe('pdf');
    const encFile = await writeTmp(enc);
    const info = execFileSync('qpdf', ['--show-encryption', '--password=Senh@ São 123', encFile]).toString();
    expect(info).toMatch(/AESv3|256/);
    expect(info).toMatch(/print low resolution: not allowed/i);

    const dec = await security.unlock(enc, 'Senh@ São 123');
    expect((await load(dec)).getPageCount()).toBe(2);
    expect((await textOf(dec))[0]).toContain(ACENTOS);
  });

  itIf(HAS_QPDF)('senha comecando com "-" e com acento: protect -> unlock', async () => {
    const password = '-abc@123 ç';
    const enc = await security.protect(await makePdf(1), { password, allowPrint: true, allowCopy: true });
    await expect(security.unlock(enc, 'abc@123 ç')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    const dec = await security.unlock(enc, password);
    expect((await load(dec)).getPageCount()).toBe(1);
  });

  itIf(HAS_QPDF)('senha errada -> WRONG_PASSWORD', async () => {
    const enc = await security.protect(await makePdf(1), { password: 'certa', allowPrint: true, allowCopy: true });
    await expect(security.unlock(enc, 'errada')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  });

  itIf(HAS_QPDF)('nao deixa arquivos temporarios para tras', async () => {
    const before = (await fs.readdir(os.tmpdir())).filter((n) => n.startsWith('pdftools-qpdf-'));
    await security.protect(await makePdf(1), { password: 'abcd', allowPrint: true, allowCopy: true });
    const after = (await fs.readdir(os.tmpdir())).filter((n) => n.startsWith('pdftools-qpdf-'));
    expect(after.length).toBeLessThanOrEqual(before.length);
  });

  itIf(HAS_QPDF)('PDF invalido -> PROCESSING_FAILED sem vazar stderr', async () => {
    const err = await security.protect(Buffer.from('%PDF-1.4 nada'), { password: 'abcd', allowPrint: true, allowCopy: true }).catch((e) => e);
    expect(err).toBeInstanceOf(PdfToolsError);
    expect(err.code).toBe('PROCESSING_FAILED');
    expect(err.message).not.toMatch(/qpdf|xref|\//i);
  });
});

// ---------------------------------------------------------------------------
describe('GhostscriptCompressorService (gs real)', () => {
  itIf(HAS_GS)('comprime um PDF pesado em "extrema" e o resultado continua valido', async () => {
    const heavy = await makeHeavyPdf();
    const out = await new GhostscriptCompressorService().compress(heavy, 'extrema');
    expect(detectFileKind(out)).toBe('pdf');
    expect(out.length).toBeLessThan(heavy.length);
    expect((await load(out)).getPageCount()).toBe(1);
  });

  itIf(HAS_GS)('"leve" num PDF de texto gera PDF valido', async () => {
    const out = await new GhostscriptCompressorService().compress(await makePdf(2), 'leve');
    expect((await load(out)).getPageCount()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('PdfParseRasterizerService + PdfParseTextExtractorService', () => {
  it('1 pagina -> JPG valido com a largura do DPI pedido', async () => {
    const pages = await rasterize(await makePdf(1, [612, 792]), [0], { format: 'jpg', dpi: 72 });
    expect(pages).toHaveLength(1);
    expect(pages[0].page).toBe(1);
    expect(detectFileKind(pages[0].data)).toBe('jpg');
    const img = await loadImage(pages[0].data);
    expect(img.width).toBe(612);
    expect(img.height).toBe(792);
  });

  it('PNG em 150 DPI escala a pagina', async () => {
    const pages = await rasterize(await makePdf(3), [2, 0], { format: 'png', dpi: 150 });
    expect(pages.map((p) => p.page)).toEqual([3, 1]);
    expect(detectFileKind(pages[0].data)).toBe('png');
    expect((await loadImage(pages[0].data)).width).toBe(625); // 300pt * 150/72
  });

  it('extrai texto por pagina com acentos', async () => {
    const file = await writeTmp(await makePdf(2));
    const result = runInNode<{ pages: number; byPage: { page: number; text: string }[] }>(
      `const { PdfParseTextExtractorService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-parse-text-extractor.service'))});
       new PdfParseTextExtractorService().extract(require('fs').readFileSync(process.argv[process.argv.length - 1]))
         .then((r) => console.log(JSON.stringify(r)));`,
      [file],
    );
    expect(result.pages).toBe(2);
    expect(result.byPage[1].page).toBe(2);
    expect(result.byPage[1].text).toContain('Pagina 2');
    expect(result.byPage[0].text).toContain(ACENTOS);
  });

  it('PdfToImagesUseCase real: 2 PDFs -> ZIP valido com 2 pastas (unzip -l / -t)', async () => {
    const a = await writeTmp(await makePdf(2));
    const b = await writeTmp(await makePdf(3));
    const c = await writeTmp(await makePdf(1));
    const out = path.join(tmpDir, 'lote.zip');
    const result = runInNode<{ fileName: string; contentType: string; meta: Record<string, number> }>(
      `const fs = require('fs');
       const { PdfToImagesUseCase } = require(${JSON.stringify(path.join(SERVICES_DIR, '../../application/use-cases/pdf-to-images.use-case'))});
       const { PdfLibEngineService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-lib-engine.service'))});
       const { PdfParseRasterizerService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-parse-rasterizer.service'))});
       const { StoreZipBuilderService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'store-zip-builder.service'))});
       const availability = { isAvailable: async () => true, getCapabilities: async () => ({}) };
       const [a, b, c, out] = process.argv.slice(-4);
       const uc = new PdfToImagesUseCase(new PdfLibEngineService(), new PdfParseRasterizerService(), new StoreZipBuilderService(), availability);
       uc.execute({ files: [
           { buffer: fs.readFileSync(a), originalname: 'Contrato São João.pdf' },
           { buffer: fs.readFileSync(b), originalname: 'planta.pdf' },
           { buffer: fs.readFileSync(c), originalname: 'contrato sao joao.pdf' },
         ], options: { format: 'jpg', dpi: 72 } })
         .then((r) => { fs.writeFileSync(out, r.data); console.log(JSON.stringify({ fileName: r.fileName, contentType: r.contentType, meta: r.meta })); })
         .catch((e) => { console.log(JSON.stringify({ error: e.code || e.message })); process.exitCode = 1; });`,
      [a, b, c, out],
    );
    expect(result.fileName).toBe('imagens_pdf.zip');
    expect(result.contentType).toBe('application/zip');
    expect(result.meta).toMatchObject({ files: 3, pages: 6, originalPages: 6 });
    const zip = await fs.readFile(out);
    const entries = readZipCentralDirectory(zip);
    expect(entries.map((e) => e.name)).toEqual([
      'Contrato Sao Joao/Contrato Sao Joao_pagina_1.jpg',
      'Contrato Sao Joao/Contrato Sao Joao_pagina_2.jpg',
      'planta/planta_pagina_1.jpg',
      'planta/planta_pagina_2.jpg',
      'planta/planta_pagina_3.jpg',
      'contrato sao joao (2)/contrato sao joao_pagina_1.jpg',
    ]);
    for (const e of entries) expect(detectFileKind(extractZipEntry(zip, e))).toBe('jpg');
    if (HAS_UNZIP) {
      expect(execFileSync('unzip', ['-t', out]).toString()).toMatch(/No errors detected/);
      const listing = execFileSync('unzip', ['-l', out]).toString();
      expect(listing).toContain('planta/planta_pagina_3.jpg');
      expect(listing).toMatch(/6 files/);
      const dest = path.join(tmpDir, 'lote-extraido');
      execFileSync('unzip', ['-q', out, '-d', dest]);
      expect((await fs.readdir(dest)).sort()).toEqual(['Contrato Sao Joao', 'contrato sao joao (2)', 'planta']);
    }
  });

  it('PDF corrompido no extrator -> PROCESSING_FAILED', async () => {
    const file = await writeTmp(Buffer.from('%PDF-1.4 nada aqui'));
    const result = runInNode<{ error?: string }>(
      `const { PdfParseTextExtractorService } = require(${JSON.stringify(path.join(SERVICES_DIR, 'pdf-parse-text-extractor.service'))});
       new PdfParseTextExtractorService().extract(require('fs').readFileSync(process.argv[process.argv.length - 1]))
         .then(() => console.log('{}'))
         .catch((e) => console.log(JSON.stringify({ error: e.code })));`,
      [file],
    );
    expect(result.error).toBe('PROCESSING_FAILED');
  });
});

// ---------------------------------------------------------------------------
describe('LibreOfficeOfficeConverterService (soffice real)', () => {
  itIf(HAS_SOFFICE)('converte .odt e .docx gerados no teste', async () => {
    // Gera os documentos de entrada a partir de um .txt com o proprio soffice.
    const srcDir = path.join(tmpDir, 'office-src');
    await fs.mkdir(srcDir);
    const txt = path.join(srcDir, 'entrada.txt');
    await fs.writeFile(txt, `Documento de teste\n${ACENTOS}\n`, 'utf8');
    const profile = `file://${path.join(tmpDir, 'lo-profile-gen')}`;
    for (const fmt of ['odt', 'docx']) {
      execFileSync(
        'soffice',
        [`-env:UserInstallation=${profile}`, '--headless', '--infilter=Text (encoded):UTF8,LF,,', '--convert-to', fmt, '--outdir', srcDir, txt],
        { timeout: 120_000, stdio: 'ignore' },
      );
    }
    const converter = new LibreOfficeOfficeConverterService();
    for (const ext of ['odt', 'docx'] as const) {
      const input = await fs.readFile(path.join(srcDir, `entrada.${ext}`));
      expect(detectFileKind(input)).toBe('zip');
      const pdf = await converter.convertToPdf({ buffer: input, extension: ext });
      expect(detectFileKind(pdf)).toBe('pdf');
      const texts = await textOf(pdf);
      expect(texts.join('\n')).toContain(ACENTOS);
    }
  });

  itIf(HAS_SOFFICE)('arquivo corrompido -> PROCESSING_FAILED', async () => {
    const converter = new LibreOfficeOfficeConverterService();
    const fake = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 7)]);
    await expect(converter.convertToPdf({ buffer: fake, extension: 'docx' })).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
  });
});

// ---------------------------------------------------------------------------
describe('BinaryAvailabilityService', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reflete os binarios instalados e o raster nativo', async () => {
    const caps = await new BinaryAvailabilityService().getCapabilities();
    expect(caps).toEqual({ office: HAS_SOFFICE, compress: HAS_GS, security: HAS_QPDF, raster: true });
  });

  it('binario inexistente (via env) -> indisponivel, sem lancar', async () => {
    process.env.QPDF_PATH = '/caminho/que/nao/existe/qpdf';
    process.env.GHOSTSCRIPT_PATH = '/caminho/que/nao/existe/gs';
    const service = new BinaryAvailabilityService();
    expect(await service.isAvailable('security')).toBe(false);
    expect(await service.isAvailable('compress')).toBe(false);
  });

  it('qpdf inexistente no momento do uso -> TOOL_UNAVAILABLE', async () => {
    process.env.QPDF_PATH = '/caminho/que/nao/existe/qpdf';
    await expect(new QpdfSecurityService().unlock(await makePdf(1), 'x')).rejects.toMatchObject({ code: 'TOOL_UNAVAILABLE' });
  });
});
