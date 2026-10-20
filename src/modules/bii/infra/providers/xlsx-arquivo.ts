// src/modules/bii/infra/providers/xlsx-arquivo.ts
// Conferencias do arquivo .xlsx ANTES de abrir com o exceljs:
// 1) assinatura ZIP local "PK\x03\x04" nos 4 primeiros bytes;
// 2) diretorio central do ZIP (anti zip-bomb): quantidade de entradas, soma
//    DECLARADA descompactada, razao de compressao por entrada, sem macro
//    (vbaProject.bin), sem entrada criptografada, sem ZIP64 (um .xlsx de ate
//    120 MB nunca precisa);
// 3) entradas CONTIGUAS: cada cabecalho local comeca onde a entrada anterior
//    termina e a ultima termina no diretorio central - nao ha dado escondido
//    fora do diretorio (o exceljs/unzipper le os cabecalhos LOCAIS em
//    streaming, entao uma entrada "fantasma" passaria pela conferencia);
// 4) descompactacao REAL de cada entrada em streaming (createInflateRaw, sem
//    guardar o conteudo), contando os bytes de verdade: o tamanho declarado
//    pode mentir. Acima de 1,5 GiB no total ou 300 MB no xl/sharedStrings.xml
//    -> recusa (o exceljs grava abas descompactadas em disco temporario e
//    guarda as strings compartilhadas em memoria).
import { createReadStream } from 'fs';
import { open } from 'fs/promises';
import { createInflateRaw } from 'zlib';

export const ZIP_MAX_ENTRADAS = 1000;
export const ZIP_MAX_DESCOMPACTADO = 2 * 1024 * 1024 * 1024; // 2 GiB declarados
export const ZIP_MAX_RAZAO = 200; // so para entradas acima de 10 MB descompactados
const ZIP_RAZAO_A_PARTIR_DE = 10 * 1024 * 1024;
const ZIP_MAX_DIRETORIO = 16 * 1024 * 1024;
const MB = 1024 * 1024;

export interface LimitesDescompactado {
  total: number; // bytes reais somados de todas as entradas
  sharedStrings: number; // bytes reais do xl/sharedStrings.xml
}

export const LIMITES_DESCOMPACTADO_PADRAO: LimitesDescompactado = {
  total: 1.5 * 1024 * MB,
  sharedStrings: 300 * MB,
};

interface EntradaZip {
  nome: string;
  metodo: number;
  flags: number;
  compactado: number;
  offsetLocal: number;
}

// Conta os bytes REAIS de uma entrada (sem guardar nada). Para assim que
// passa do limite (destroi os streams). STORE (0) = o proprio tamanho.
function contarDescompactado(caminho: string, inicio: number, e: EntradaZip, limite: number): Promise<number> {
  if (e.compactado === 0) return Promise.resolve(0);
  return new Promise((resolve, reject) => {
    const origem = createReadStream(caminho, { start: inicio, end: inicio + e.compactado - 1 });
    let total = 0;
    let terminou = false;
    const fim = (erro: Error | null, n?: number) => {
      if (terminou) return;
      terminou = true;
      origem.destroy();
      if (erro) reject(erro);
      else resolve(n ?? total);
    };
    if (e.metodo === 0) {
      origem.on('data', (b: Buffer | string) => {
        total += b.length;
        if (total > limite) fim(null, total);
      });
      origem.on('end', () => fim(null, total));
      origem.on('error', () => fim(new ArquivoXlsxInvalidoError('O arquivo não é uma planilha .xlsx válida.')));
      return;
    }
    const inflar = createInflateRaw();
    inflar.on('data', (b: Buffer) => {
      total += b.length;
      if (total > limite) {
        inflar.destroy();
        fim(null, total);
      }
    });
    inflar.on('end', () => fim(null, total));
    inflar.on('error', () => fim(new ArquivoXlsxInvalidoError('O arquivo não é uma planilha .xlsx válida.')));
    origem.on('error', () => fim(new ArquivoXlsxInvalidoError('O arquivo não é uma planilha .xlsx válida.')));
    origem.pipe(inflar);
  });
}

export class ArquivoXlsxInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ArquivoXlsxInvalidoError';
  }
}

export async function temAssinaturaZip(caminho: string): Promise<boolean> {
  const fh = await open(caminho, 'r');
  try {
    const buf = Buffer.alloc(4);
    const { bytesRead } = await fh.read(buf, 0, 4, 0);
    return bytesRead === 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  } finally {
    await fh.close();
  }
}

export interface InspecaoZip {
  entradas: number;
  descompactadoDeclarado: number;
  descompactadoReal: number;
  compactado: number;
}

export async function inspecionarZip(
  caminho: string,
  limites: LimitesDescompactado = LIMITES_DESCOMPACTADO_PADRAO,
): Promise<InspecaoZip> {
  const invalido = () => new ArquivoXlsxInvalidoError('O arquivo não é uma planilha .xlsx válida.');
  const fh = await open(caminho, 'r');
  try {
    const { size } = await fh.stat();
    if (size < 22) throw invalido();
    // EOCD: ultimos 22 bytes + comentario de ate 65535
    const tamCauda = Math.min(size, 22 + 65_535);
    const cauda = Buffer.alloc(tamCauda);
    await fh.read(cauda, 0, tamCauda, size - tamCauda);
    let eocd = -1;
    for (let i = tamCauda - 22; i >= 0; i--) {
      if (cauda.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw invalido();
    const total = cauda.readUInt16LE(eocd + 10);
    const tamDir = cauda.readUInt32LE(eocd + 12);
    const offDir = cauda.readUInt32LE(eocd + 16);
    if (total === 0xffff || tamDir === 0xffffffff || offDir === 0xffffffff) {
      throw new ArquivoXlsxInvalidoError('Formato de planilha não suportado (ZIP64).');
    }
    if (total > ZIP_MAX_ENTRADAS) throw new ArquivoXlsxInvalidoError('A planilha tem partes internas demais.');
    if (tamDir > ZIP_MAX_DIRETORIO || offDir + tamDir > size) throw invalido();
    const dir = Buffer.alloc(tamDir);
    await fh.read(dir, 0, tamDir, offDir);

    let pos = 0;
    let soma = 0;
    let compactado = 0;
    const entradas: EntradaZip[] = [];
    for (let n = 0; n < total; n++) {
      if (pos + 46 > dir.length || dir.readUInt32LE(pos) !== 0x02014b50) throw invalido();
      const flags = dir.readUInt16LE(pos + 8);
      const comp = dir.readUInt32LE(pos + 20);
      const desc = dir.readUInt32LE(pos + 24);
      const lenNome = dir.readUInt16LE(pos + 28);
      const lenExtra = dir.readUInt16LE(pos + 30);
      const lenComent = dir.readUInt16LE(pos + 32);
      const metodo = dir.readUInt16LE(pos + 10);
      const offsetLocal = dir.readUInt32LE(pos + 42);
      const nome = dir.toString('latin1', pos + 46, pos + 46 + lenNome).toLowerCase();
      if (comp === 0xffffffff || desc === 0xffffffff) {
        throw new ArquivoXlsxInvalidoError('Formato de planilha não suportado (ZIP64).');
      }
      if (flags & 0x1) throw new ArquivoXlsxInvalidoError('A planilha está protegida por senha.');
      if (nome.endsWith('vbaproject.bin')) {
        throw new ArquivoXlsxInvalidoError('A planilha contém macros. Salve como .xlsx sem macros.');
      }
      if (desc > ZIP_RAZAO_A_PARTIR_DE && desc / Math.max(comp, 1) > ZIP_MAX_RAZAO) {
        throw new ArquivoXlsxInvalidoError('A planilha tem compressão suspeita e foi recusada.');
      }
      if (metodo !== 0 && metodo !== 8) throw new ArquivoXlsxInvalidoError('Formato de planilha não suportado.');
      soma += desc;
      compactado += comp;
      if (soma > ZIP_MAX_DESCOMPACTADO) throw new ArquivoXlsxInvalidoError('A planilha descompactada passa do limite.');
      entradas.push({ nome, metodo, flags, compactado: comp, offsetLocal });
      pos += 46 + lenNome + lenExtra + lenComent;
    }

    // contiguidade + descompactacao real, na ordem fisica do arquivo
    const porOffset = [...entradas].sort((a, b) => a.offsetLocal - b.offsetLocal);
    let esperado = 0;
    let real = 0;
    const cab = Buffer.alloc(30);
    const desc = Buffer.alloc(16);
    for (const e of porOffset) {
      if (e.offsetLocal !== esperado) throw invalido();
      const { bytesRead } = await fh.read(cab, 0, 30, e.offsetLocal);
      if (bytesRead !== 30 || cab.readUInt32LE(0) !== 0x04034b50) throw invalido();
      const inicioDados = e.offsetLocal + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
      let fimEntrada = inicioDados + e.compactado;
      if (e.flags & 0x8) {
        // data descriptor: 12 bytes, ou 16 com a assinatura opcional
        await fh.read(desc, 0, 16, fimEntrada);
        fimEntrada += desc.readUInt32LE(0) === 0x08074b50 ? 16 : 12;
      }
      if (fimEntrada > offDir) throw invalido();
      const restante = limites.total - real;
      const limiteEntrada = e.nome === 'xl/sharedstrings.xml' ? Math.min(restante, limites.sharedStrings) : restante;
      const bytes = await contarDescompactado(caminho, inicioDados, e, limiteEntrada);
      if (e.nome === 'xl/sharedstrings.xml' && bytes > limites.sharedStrings) {
        throw new ArquivoXlsxInvalidoError(
          `A planilha tem texto demais (mais de ${Math.round(limites.sharedStrings / MB)} MB de textos compartilhados) e foi recusada.`,
        );
      }
      real += bytes;
      if (real > limites.total) {
        throw new ArquivoXlsxInvalidoError(
          `A planilha descompactada passa de ${(limites.total / (1024 * MB)).toLocaleString('pt-BR')} GB e foi recusada.`,
        );
      }
      esperado = fimEntrada;
    }
    if (esperado !== offDir) throw invalido();
    return { entradas: total, descompactadoDeclarado: soma, descompactadoReal: real, compactado };
  } finally {
    await fh.close();
  }
}
