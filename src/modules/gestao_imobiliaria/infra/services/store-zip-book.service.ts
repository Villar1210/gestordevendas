// src/modules/gestao_imobiliaria/infra/services/store-zip-book.service.ts
// ZIP minimalista, metodo STORE (sem compressao - JPGs ja sao comprimidos),
// CRC32 calculado a mao, nomes em UTF-8. Mesma tecnica do
// StoreZipBuilderService do modulo pdf_tools (copiada de proposito: um modulo
// nao importa o outro - ver arquivo-book.ts). Sem dependencia nova.
// Sem ZIP64: ate 65535 entradas e 4 GB - muito acima de 80 paginas de ~0,5 MB.
import { Injectable } from '@nestjs/common';
import { IZipBookService } from '../../domain/services/zip-book.interface';

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

// Um unico segmento: nada de "../", barra inicial, separadores ou controle.
function nomeSeguro(nome: string): string {
  const limpo = nome.replace(/[\\/]+/g, '_').replace(/^\.+/, '').replace(/[\u0000-\u001f]/g, '');
  return limpo || 'arquivo';
}

function dataHoraDos(data: Date): { hora: number; dia: number } {
  const ano = Math.max(1980, data.getFullYear());
  return {
    hora: ((data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2)) & 0xffff,
    dia: (((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate()) & 0xffff,
  };
}

@Injectable()
export class StoreZipBookService implements IZipBookService {
  montar(arquivos: { nome: string; dados: Buffer }[]): Buffer {
    if (arquivos.length === 0 || arquivos.length > 0xffff) {
      throw new Error('Quantidade de arquivos inválida para o ZIP.');
    }
    const { hora, dia } = dataHoraDos(new Date());
    const locais: Buffer[] = [];
    const centrais: Buffer[] = [];
    let offset = 0;

    for (const arquivo of arquivos) {
      const nome = Buffer.from(nomeSeguro(arquivo.nome), 'utf8');
      const dados = arquivo.dados;
      const crc = crc32(dados);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); // local file header
      local.writeUInt16LE(20, 4); // versao necessaria (2.0)
      local.writeUInt16LE(0x0800, 6); // flag: nomes em UTF-8
      local.writeUInt16LE(0, 8); // metodo 0 = STORE
      local.writeUInt16LE(hora, 10);
      local.writeUInt16LE(dia, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(dados.length, 18);
      local.writeUInt32LE(dados.length, 22);
      local.writeUInt16LE(nome.length, 26);
      local.writeUInt16LE(0, 28);
      locais.push(local, nome, dados);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0); // central directory
      central.writeUInt16LE(0x0314, 4); // versao criadora (Unix, 2.0)
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(hora, 12);
      central.writeUInt16LE(dia, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(dados.length, 20);
      central.writeUInt32LE(dados.length, 24);
      central.writeUInt16LE(nome.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // rw-r--r--
      central.writeUInt32LE(offset, 42);
      centrais.push(central, nome);

      offset += local.length + nome.length + dados.length;
      if (offset > 0xffffffff) throw new Error('O arquivo ZIP ficaria grande demais.');
    }

    const tamanhoCentral = centrais.reduce((soma, b) => soma + b.length, 0);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0); // end of central directory
    fim.writeUInt16LE(arquivos.length, 8);
    fim.writeUInt16LE(arquivos.length, 10);
    fim.writeUInt32LE(tamanhoCentral, 12);
    fim.writeUInt32LE(offset, 16);
    return Buffer.concat([...locais, ...centrais, fim]);
  }
}
