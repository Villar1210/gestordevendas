// src/modules/gestao_imobiliaria/domain/services/foto-upload.ts
// Camada de DOMINIO (pura): tipo REAL de uma foto pelos bytes iniciais
// (magic bytes), nunca pelo nome/mimetype enviados pelo navegador. Usado no
// upload de foto de imovel e de empreendimento: so JPG/PNG/WebP, e o arquivo
// e gravado com a extensao do tipo real (o nome original do usuario nao vai
// para o disco - /uploads e publico, "x.html" viraria pagina servida).
export const FOTO_MAX_BYTES = 10 * 1024 * 1024;
export const MENSAGEM_FOTO_INVALIDA = 'Envie uma foto JPG, PNG ou WebP.';

export interface TipoFoto {
  extensao: 'jpg' | 'png' | 'webp';
  mimetype: 'image/jpeg' | 'image/png' | 'image/webp';
}

export function detectarTipoFoto(bytes: Uint8Array | null | undefined): TipoFoto | null {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extensao: 'jpg', mimetype: 'image/jpeg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { extensao: 'png', mimetype: 'image/png' };
  }
  const ascii = (inicio: number, fim: number) => String.fromCharCode(...bytes.subarray(inicio, fim));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { extensao: 'webp', mimetype: 'image/webp' };
  }
  return null;
}
