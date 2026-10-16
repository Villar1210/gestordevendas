import { detectarTipoFoto } from './foto-upload';

describe('detectarTipoFoto (magic bytes)', () => {
  const comPreenchimento = (inicio: number[] | Buffer) => Buffer.concat([Buffer.from(inicio), Buffer.alloc(16)]);

  it('JPEG FF D8 FF', () => expect(detectarTipoFoto(comPreenchimento([0xff, 0xd8, 0xff]))?.extensao).toBe('jpg'));
  it('PNG 89 50 4E 47', () => expect(detectarTipoFoto(comPreenchimento([0x89, 0x50, 0x4e, 0x47]))?.extensao).toBe('png'));
  it('WebP RIFF....WEBP', () =>
    expect(detectarTipoFoto(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))?.extensao).toBe('webp'));

  it.each([
    ['RIFF sem WEBP (WAV)', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)])],
    ['GIF', comPreenchimento(Buffer.from('GIF89a'))],
    ['HTML', comPreenchimento(Buffer.from('<html>'))],
    ['SVG', comPreenchimento(Buffer.from('<svg xmlns'))],
    ['PDF', comPreenchimento(Buffer.from('%PDF-1.7'))],
    ['curto demais', Buffer.from([0xff, 0xd8, 0xff])],
  ])('%s: recusado', (_n, bytes) => expect(detectarTipoFoto(bytes)).toBeNull());

  it('null/undefined: recusado', () => {
    expect(detectarTipoFoto(undefined)).toBeNull();
    expect(detectarTipoFoto(null)).toBeNull();
  });
});
