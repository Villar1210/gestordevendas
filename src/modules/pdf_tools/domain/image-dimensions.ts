// src/modules/pdf_tools/domain/image-dimensions.ts
// Le largura x altura de JPG/PNG direto do CABECALHO, sem decodificar a
// imagem. Usado para recusar "bombas de descompressao" (PNG de poucos KB
// declarando 20000x20000 px) antes de entregar a imagem ao pdf-lib.
// Funcao pura, sem dependencias externas.
export const MAX_IMAGE_PIXELS = 30_000_000;

export interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(buf: Buffer): ImageDimensions | null {
  // assinatura (8) + tamanho do chunk (4) + "IHDR" (4) + largura (4) + altura (4)
  if (buf.length < 24) return null;
  if (!PNG_SIGNATURE.every((b, i) => buf[i] === b)) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpeg(buf: Buffer): ImageDimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return null; // fora de sincronia: cabecalho invalido
    const marker = buf[pos + 1];
    if (marker === 0xff) {
      pos += 1; // bytes de preenchimento
      continue;
    }
    // Marcadores sem segmento (TEM, RSTn, SOI)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS antes de SOF
    const length = buf.readUInt16BE(pos + 2);
    if (length < 2) return null;
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (pos + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
    }
    pos += 2 + length;
  }
  return null;
}

/** Dimensoes declaradas no cabecalho, ou null se ilegivel. */
export function readImageDimensions(buf: Buffer, kind: 'jpg' | 'png'): ImageDimensions | null {
  const dims = kind === 'png' ? readPng(buf) : readJpeg(buf);
  if (!dims || dims.width < 1 || dims.height < 1) return null;
  return dims;
}
