// src/modules/pdf_tools/domain/page-range.ts
// Parser puro de intervalos de paginas digitados pelo usuario
// ("1-3,5,8-") -> indices 0-based, validados contra o total de paginas.
// Sem dependencias externas.
import { invalidInput } from './pdf-tools.errors';

const MAX_SPEC_LENGTH = 500;

interface Segment {
  start: number; // 1-based, inclusivo
  end: number; // 1-based, inclusivo
}

function parseSegment(raw: string, totalPages: number): Segment {
  const token = raw.trim();
  if (token === '') {
    throw invalidInput('Intervalo de páginas inválido: há uma vírgula sobrando.');
  }
  const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(token);
  if (!match || (!match[1] && !match[3])) {
    throw invalidInput(`Intervalo de páginas inválido: "${token}". Use por exemplo 1-3,5,8-.`);
  }
  const hasDash = Boolean(match[2]);
  if (!hasDash && match[3] !== undefined) {
    // "12" cai em match[1]; sem traco nao pode haver segundo numero
    throw invalidInput(`Intervalo de páginas inválido: "${token}".`);
  }
  const start = match[1] !== undefined ? Number(match[1]) : 1;
  const end = hasDash ? (match[3] !== undefined ? Number(match[3]) : totalPages) : start;

  if (start < 1 || end < 1) {
    throw invalidInput('As páginas começam em 1.');
  }
  if (start > end) {
    throw invalidInput(`Intervalo de páginas inválido: "${token}" (início maior que o fim).`);
  }
  if (end > totalPages) {
    throw invalidInput(
      `A página ${end} não existe: este PDF tem ${totalPages} ${totalPages === 1 ? 'página' : 'páginas'}.`,
    );
  }
  return { start, end };
}

function parseSegments(spec: string, totalPages: number): Segment[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw invalidInput('O PDF não tem páginas.');
  }
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw invalidInput('Informe as páginas (por exemplo 1-3,5,8-).');
  }
  if (spec.length > MAX_SPEC_LENGTH) {
    throw invalidInput('Intervalo de páginas muito longo.');
  }
  return spec.split(/[,;]/).map((part) => parseSegment(part, totalPages));
}

/**
 * "1-3,5,8-" -> [0,1,2,4,7,8,...] (0-based), na ordem digitada e sem
 * repeticoes. Lanca PdfToolsError(INVALID_INPUT) com mensagem clara.
 */
export function parsePageRange(spec: string, totalPages: number): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const seg of parseSegments(spec, totalPages)) {
    for (let p = seg.start; p <= seg.end; p++) {
      if (!seen.has(p - 1)) {
        seen.add(p - 1);
        result.push(p - 1);
      }
    }
  }
  return result;
}

/**
 * "1-3,4-6" -> [[0,1,2],[3,4,5]] - um grupo por intervalo (ferramenta
 * Dividir, modo "ranges"). Repeticoes entre grupos sao permitidas.
 */
export function parsePageRangeGroups(spec: string, totalPages: number): number[][] {
  return parseSegments(spec, totalPages).map((seg) => {
    const group: number[] = [];
    for (let p = seg.start; p <= seg.end; p++) group.push(p - 1);
    return group;
  });
}
