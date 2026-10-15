// Revisao de seguranca do leitor de PDF do book (PDFs gerados no proprio
// teste - nada binario no repositorio):
// C1 - imagem embutida gigante ("bomba") e ignorada pelo pdfjs (maxImageSize);
// C2 - proporcao calculada pelo CropBox (o que o pdfjs desenha), nao MediaBox;
// A1 - texto de PDF com milhares de paginas: le so as primeiras N;
// L3 - erro do pdfjs nunca vai para o usuario (mensagem fixa).
// pdf-parse (pdfjs) carrega o worker com import() dinamico, bloqueado na VM
// do jest: o SERVICO REAL roda num processo Node de verdade (ts-node
// transpile-only), mesmo padrao do pdf-tools.infra.integration.spec.ts. Isso
// tambem da a medida real de memoria do processo (maxRSS).
import { execFileSync } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { createDeflate } from 'zlib';

jest.setTimeout(180_000);

const RAIZ = resolve(__dirname, '../../../../..');
const SERVICO = join(__dirname, 'pdf-parse-pdf-reader.service');

interface Resultado {
  ok: boolean;
  erro?: string;
  ms: number;
  maxRssMb: number;
  dados?: unknown;
}

// metodo: 'renderizar' | 'texto' | 'contar'; devolve o resultado + tempo e
// pico de memoria do processo filho.
function rodar(arquivo: string, metodo: string, opcoes: Record<string, unknown> = {}): Resultado {
  const script = `
    const { PdfParsePdfReaderService } = require(${JSON.stringify(SERVICO)});
    const pdf = require('fs').readFileSync(process.argv[process.argv.length - 2]);
    const o = JSON.parse(process.argv[process.argv.length - 1]);
    const s = new PdfParsePdfReaderService();
    const inicio = Date.now();
    const fim = (ok, extra) => console.log(JSON.stringify({ ok, ms: Date.now() - inicio,
      maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024), ...extra }));
    const chamada = o.metodo === 'renderizar'
      ? s.renderizarPaginas(pdf, o.paginas, { larguraPx: o.largura, qualidadeJpeg: 60 }).then((r) => r.map((p) => ({
          numero: p.numero, largura: p.largura, altura: p.altura, jpeg: p.jpeg.toString('base64') })))
      : o.metodo === 'texto' ? s.lerTextoPorPagina(pdf, { maxPaginas: o.max })
      : s.contarPaginas(pdf);
    chamada.then((dados) => fim(true, { dados }), (e) => fim(false, { erro: e.message }));`;
  const saida = execFileSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', '-e', script, '--', arquivo, JSON.stringify({ metodo, ...opcoes })],
    {
      cwd: RAIZ,
      env: { ...process.env, TS_NODE_PROJECT: join(RAIZ, 'tsconfig.json'), NODE_OPTIONS: '--max-old-space-size=2048' },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 150_000,
    },
  ).toString();
  return JSON.parse(saida.trim().split('\n').pop()!) as Resultado;
}

// PDF minimo escrito a mao (xref correto). objetos[i] = corpo do objeto i+1.
function montarPdf(objetos: (string | Buffer)[]): Buffer {
  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let tamanho = partes[0].length;
  objetos.forEach((corpo, i) => {
    offsets.push(tamanho);
    const bloco = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, 'latin1'),
      typeof corpo === 'string' ? Buffer.from(corpo, 'latin1') : corpo,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    partes.push(bloco);
    tamanho += bloco.length;
  });
  const xref =
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${tamanho}\n%%EOF\n`;
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}

// Pagina com MediaBox 1000x1000 e CropBox estreito (larguraCrop x 1000).
function pdfComCropBox(larguraCrop: number): Buffer {
  const conteudo = '0 0 1 rg 0 0 1000 1000 re f';
  return montarPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 1000] /CropBox [0 0 ${larguraCrop} 1000] /Contents 4 0 R >>`,
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ]);
}

// "Bomba": pagina 600x800 com UMA imagem lado x lado RGB comprimida (zeros
// = preta). Comprimida fica pequena; decodificada ocuparia lado*lado*3 bytes.
async function pdfBomba(lado: number): Promise<Buffer> {
  const comprimido = await new Promise<Buffer>((resolve, reject) => {
    const deflate = createDeflate({ level: 9 });
    const saida: Buffer[] = [];
    deflate.on('data', (b: Buffer) => saida.push(b));
    deflate.on('end', () => resolve(Buffer.concat(saida)));
    deflate.on('error', reject);
    const linha = Buffer.alloc(lado * 3 * 64); // 64 linhas por vez
    let restantes = lado;
    const escrever = () => {
      while (restantes > 0) {
        const n = Math.min(64, restantes);
        restantes -= n;
        if (!deflate.write(n === 64 ? linha : linha.subarray(0, lado * 3 * n))) {
          deflate.once('drain', escrever);
          return;
        }
      }
      deflate.end();
    };
    escrever();
  });
  const conteudo = 'q 600 0 0 800 0 0 cm /Im1 Do Q';
  return montarPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${lado} /Height ${lado} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${comprimido.length} >>\nstream\n`,
        'latin1',
      ),
      comprimido,
      Buffer.from('\nendstream', 'latin1'),
    ]),
  ]);
}

async function corDoCentro(jpeg: Buffer): Promise<number[]> {
  const imagem = await loadImage(jpeg);
  const canvas = createCanvas(imagem.width, imagem.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imagem, 0, 0);
  return [...ctx.getImageData(Math.floor(imagem.width / 2), Math.floor(imagem.height / 2), 1, 1).data].slice(0, 3);
}

type PaginaRender = { numero: number; largura: number; altura: number; jpeg: string };

describe('PdfParsePdfReaderService - protecoes (processo Node real)', () => {
  let pasta: string;
  let seq = 0;
  const gravar = async (dados: Buffer) => {
    const arquivo = join(pasta, `t${++seq}.pdf`);
    await writeFile(arquivo, dados);
    return arquivo;
  };

  beforeAll(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'gdv-pdf-sec-'));
  });

  afterAll(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it('C1: "bomba" 20.000 x 20.000 (1,2 GB decodificada) em PDF de ~1 MB e ignorada - rapido e memoria baixa', async () => {
    const pdf = await pdfBomba(20_000);
    expect(pdf.length).toBeLessThan(3 * 1024 * 1024);
    const r = rodar(await gravar(pdf), 'renderizar', { paginas: [1], largura: 480 });
    expect(r.ok).toBe(true);
    const [pagina] = r.dados as PaginaRender[];
    expect(pagina.largura).toBe(480);
    // A imagem (preta) foi ignorada: a pagina sai branca.
    expect((await corDoCentro(Buffer.from(pagina.jpeg, 'base64'))).every((c) => c > 200)).toBe(true);
    expect(r.ms).toBeLessThan(30_000);
    // Antes da correcao o processo passava de 5 GB; tolerante ao ambiente.
    expect(r.maxRssMb).toBeLessThan(900);
  });

  it('C2: MediaBox 1000x1000 com CropBox 10x1000 -> pagina pulada (nao renderiza 1600 x 160.000)', async () => {
    const r = rodar(await gravar(pdfComCropBox(10)), 'renderizar', { paginas: [1], largura: 1600 });
    expect(r).toMatchObject({ ok: true, dados: [] });
    expect(r.ms).toBeLessThan(10_000);
  });

  it('C2: CropBox moderado (500x1000, proporcao 2) e renderizado mais estreito, dentro da altura maxima', async () => {
    const r = rodar(await gravar(pdfComCropBox(500)), 'renderizar', { paginas: [1], largura: 1600 });
    const [pagina] = r.dados as PaginaRender[];
    expect(pagina.altura).toBeLessThanOrEqual(Math.ceil(1600 * 1.6 * 1.05));
    expect(pagina.largura).toBeLessThan(1600);
  });

  it('A1: PDF de 2.000 paginas - le so as primeiras 81 e devolve o total real, rapido', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 2000; i++) doc.addPage([200, 200]).drawText(`p${i + 1}`, { x: 10, y: 10, size: 12 });
    const r = rodar(await gravar(Buffer.from(await doc.save())), 'texto', { max: 81 });
    const dados = r.dados as { totalPaginas: number; paginas: { numero: number; texto: string }[] };
    expect(dados.totalPaginas).toBe(2000);
    expect(dados.paginas).toHaveLength(81);
    expect(dados.paginas[80].texto).toContain('p81');
    expect(r.ms).toBeLessThan(15_000);
  });

  it('L3: PDF invalido -> mensagem fixa, sem detalhe do pdfjs/pdf-lib', async () => {
    const lixo = await gravar(Buffer.from('%PDF-1.7\nisto nao e um pdf de verdade'));
    for (const [metodo, opcoes] of [
      ['texto', { max: 81 }],
      ['renderizar', { paginas: [1], largura: 100 }],
      ['contar', {}],
    ] as const) {
      const r = rodar(lixo, metodo, opcoes);
      expect({ metodo, ok: r.ok, erro: r.erro }).toEqual({ metodo, ok: false, erro: 'Não foi possível ler o arquivo PDF.' });
    }
  });
});
