// src/modules/gestao_imobiliaria/domain/services/arquivo-book.ts
// Tipo real dos arquivos do book pelo CONTEUDO ("magic bytes"), nunca pela
// extensao/mimetype enviados pelo navegador, e dimensoes de JPEG lidas do
// cabecalho SEM decodificar a imagem (protecao contra "bomba" de memoria).
// Funcoes puras, sem dependencias externas. Mesma tecnica do modulo
// pdf_tools (copiada de proposito: um modulo nao importa o outro).

export type TipoArquivoBook = 'pdf' | 'jpeg' | 'outro';

export function detectarTipoArquivoBook(buffer: Buffer): TipoArquivoBook {
  // PDF: alguns geradores colocam lixo/BOM antes de "%PDF-"; o leitor tolera
  // ate 1 KB (mesmo criterio que o book ja usava).
  if (buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  return 'outro';
}

export interface DimensoesImagem {
  largura: number;
  altura: number;
}

// Percorre os segmentos do JPEG ate o SOF (Start Of Frame), que traz
// altura/largura. Devolve null se o cabecalho for invalido/truncado.
export function lerDimensoesJpeg(buf: Buffer): DimensoesImagem | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return null; // fora de sincronia: cabecalho invalido
    const marcador = buf[pos + 1];
    if (marcador === 0xff) {
      pos += 1; // bytes de preenchimento
      continue;
    }
    // Marcadores sem segmento (TEM, RSTn, SOI)
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (marcador === 0xd9 || marcador === 0xda) return null; // EOI/SOS antes do SOF
    const tamanho = buf.readUInt16BE(pos + 2);
    if (tamanho < 2) return null;
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC)
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      if (pos + 9 > buf.length) return null;
      const altura = buf.readUInt16BE(pos + 5);
      const largura = buf.readUInt16BE(pos + 7);
      return largura >= 1 && altura >= 1 ? { largura, altura } : null;
    }
    pos += 2 + tamanho;
  }
  return null;
}
