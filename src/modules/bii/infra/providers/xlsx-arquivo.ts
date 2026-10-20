// src/modules/bii/infra/providers/xlsx-arquivo.ts
// Conferencias do arquivo .xlsx ANTES de abrir com o exceljs:
// 1) assinatura ZIP local "PK\x03\x04" nos 4 primeiros bytes;
// 2) diretorio central do ZIP (anti zip-bomb): quantidade de entradas, soma
//    DECLARADA descompactada, razao de compressao por entrada, sem macro
//    (vbaProject.bin), sem entrada criptografada, sem ZIP64 (um .xlsx de ate
//    120 MB nunca precisa). Os tamanhos declarados podem mentir: por isso o
//    leitor tambem limita linhas e bytes LIDOS (itbi-planilha.reader.ts).
import { open } from 'fs/promises';

export const ZIP_MAX_ENTRADAS = 1000;
export const ZIP_MAX_DESCOMPACTADO = 2 * 1024 * 1024 * 1024; // 2 GiB declarados
export const ZIP_MAX_RAZAO = 200; // so para entradas acima de 10 MB descompactados
const ZIP_RAZAO_A_PARTIR_DE = 10 * 1024 * 1024;
const ZIP_MAX_DIRETORIO = 16 * 1024 * 1024;

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
  compactado: number;
}

export async function inspecionarZip(caminho: string): Promise<InspecaoZip> {
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
    for (let n = 0; n < total; n++) {
      if (pos + 46 > dir.length || dir.readUInt32LE(pos) !== 0x02014b50) throw invalido();
      const flags = dir.readUInt16LE(pos + 8);
      const comp = dir.readUInt32LE(pos + 20);
      const desc = dir.readUInt32LE(pos + 24);
      const lenNome = dir.readUInt16LE(pos + 28);
      const lenExtra = dir.readUInt16LE(pos + 30);
      const lenComent = dir.readUInt16LE(pos + 32);
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
      soma += desc;
      compactado += comp;
      if (soma > ZIP_MAX_DESCOMPACTADO) throw new ArquivoXlsxInvalidoError('A planilha descompactada passa do limite.');
      pos += 46 + lenNome + lenExtra + lenComent;
    }
    return { entradas: total, descompactadoDeclarado: soma, compactado };
  } finally {
    await fh.close();
  }
}
