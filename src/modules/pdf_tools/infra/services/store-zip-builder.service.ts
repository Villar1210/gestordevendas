// src/modules/pdf_tools/infra/services/store-zip-builder.service.ts
// ZIP minimalista, metodo STORE (sem compressao - PDFs/JPGs ja sao
// comprimidos), CRC32 calculado a mao. Sem dependencia externa.
// Nomes em UTF-8 (flag de bit 11). Sem ZIP64: limite de 65535 entradas e
// 4 GB - muito acima dos limites do modulo.
import { Injectable } from '@nestjs/common';
import { IZipBuilder, ZipEntry } from '../../domain/services/zip-builder.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff,
    date: (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff,
  };
}

function safeEntryName(name: string): string {
  // Sem caminhos: nada de "../", barra inicial ou separadores.
  const cleaned = name.replace(/[\\/]+/g, '_').replace(/^\.+/, '').replace(/[\u0000-\u001f]/g, '');
  return cleaned || 'arquivo';
}

@Injectable()
export class StoreZipBuilderService implements IZipBuilder {
  build(entries: ZipEntry[]): Buffer {
    if (entries.length === 0 || entries.length > 0xffff) {
      throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível gerar o arquivo ZIP.');
    }
    const { time, date } = dosDateTime(new Date());
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
      const name = Buffer.from(safeEntryName(entry.name), 'utf8');
      const data = entry.data;
      const crc = crc32(data);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); // assinatura local file header
      local.writeUInt16LE(20, 4); // versao necessaria (2.0)
      local.writeUInt16LE(0x0800, 6); // flag: nomes em UTF-8
      local.writeUInt16LE(0, 8); // metodo 0 = STORE
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18); // tamanho comprimido
      local.writeUInt32LE(data.length, 22); // tamanho original
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28); // extra
      localParts.push(local, name, data);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0); // assinatura central directory
      central.writeUInt16LE(0x0314, 4); // versao criadora (Unix, 2.0)
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(time, 12);
      central.writeUInt16LE(date, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(data.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(name.length, 28);
      central.writeUInt16LE(0, 30); // extra
      central.writeUInt16LE(0, 32); // comentario
      central.writeUInt16LE(0, 34); // disco
      central.writeUInt16LE(0, 36); // atributos internos
      central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // atributos externos (rw-r--r--)
      central.writeUInt32LE(offset, 42);
      centralParts.push(central, name);

      offset += local.length + name.length + data.length;
      if (offset > 0xffffffff) {
        throw new PdfToolsError('TOO_LARGE', 'O arquivo ZIP ficaria grande demais.');
      }
    }

    const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, ...centralParts, end]);
  }
}
