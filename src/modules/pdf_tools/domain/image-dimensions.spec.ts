import { MAX_IMAGE_PIXELS, readImageDimensions } from './image-dimensions';

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function jpeg(width: number, height: number, sofMarker = 0xc0): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46]); // APP0 (4 bytes de dados)
  const dht = Buffer.from([0xff, 0xc4, 0x00, 0x03, 0x00]); // DHT nao e SOF
  const sof = Buffer.alloc(11);
  sof[0] = 0xff;
  sof[1] = sofMarker;
  sof.writeUInt16BE(9, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, Buffer.from([0xff]), dht, sof, Buffer.from([0xff, 0xd9])]);
}

describe('readImageDimensions', () => {
  it('le o IHDR do PNG', () => {
    expect(readImageDimensions(png(640, 480), 'png')).toEqual({ width: 640, height: 480 });
  });

  it('PNG forjado declarando 20000x20000 com poucos bytes passa do teto', () => {
    const forged = png(20000, 20000);
    expect(forged.length).toBeLessThan(64);
    const dims = readImageDimensions(forged, 'png')!;
    expect(dims.width * dims.height).toBeGreaterThan(MAX_IMAGE_PIXELS);
  });

  it('le SOF0 e SOF2 (progressivo) do JPEG, pulando APPn/DHT e bytes de preenchimento', () => {
    expect(readImageDimensions(jpeg(1920, 1080), 'jpg')).toEqual({ width: 1920, height: 1080 });
    expect(readImageDimensions(jpeg(300, 200, 0xc2), 'jpg')).toEqual({ width: 300, height: 200 });
  });

  it('cabecalho ilegivel ou dimensao zero -> null', () => {
    expect(readImageDimensions(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'png')).toBeNull();
    expect(readImageDimensions(png(0, 10), 'png')).toBeNull();
    expect(readImageDimensions(Buffer.from([0xff, 0xd8, 0xff]), 'jpg')).toBeNull();
    expect(readImageDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]), 'jpg')).toBeNull(); // SOS antes de SOF
    expect(readImageDimensions(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0, 0]), 'jpg')).toBeNull();
    expect(readImageDimensions(jpeg(0, 10), 'jpg')).toBeNull();
    // SOF truncado
    expect(readImageDimensions(jpeg(100, 100).subarray(0, 22), 'jpg')).toBeNull();
  });
});
