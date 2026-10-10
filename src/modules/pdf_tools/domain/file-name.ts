// src/modules/pdf_tools/domain/file-name.ts
// Regras puras de nome do arquivo de saida: deriva do nome original
// sanitizado (so [a-zA-Z0-9._ -], max 80) + sufixo da ferramenta.
const MAX_BASE_LENGTH = 80;
const FALLBACK_BASE = 'documento';

export function sanitizeBaseName(originalName: string | undefined | null): string {
  if (!originalName) return FALLBACK_BASE;
  // remove caminho (C:\fakepath\x.pdf, ../x.pdf) e a extensao
  const lastSegment = originalName.split(/[\\/]/).pop() ?? '';
  const withoutExt = lastSegment.replace(/\.[^.]{1,10}$/, '');
  const cleaned = withoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos: "São" -> "Sao"
    .replace(/[^a-zA-Z0-9._ -]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[\s._-]+|[\s._-]+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/[\s._-]+$/g, '');
  return cleaned || FALLBACK_BASE;
}

export function buildOutputFileName(originalName: string | undefined | null, suffix: string, extension: string): string {
  return `${sanitizeBaseName(originalName)}_${suffix}.${extension}`;
}
