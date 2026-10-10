// src/features/pdf_tools/lib/format.ts
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)} KB`;
  return `${numberFormatter.format(bytes / (1024 * 1024))} MB`;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  // Da tempo ao navegador de iniciar o download antes de revogar.
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

// Validacao leve de intervalos ("1-3,5,8-") so para dar retorno imediato;
// o backend continua sendo a fonte da verdade (valida contra o total).
export function validateRangeSyntax(value: string, { allowEmpty }: { allowEmpty: boolean }): string | null {
  const trimmed = value.replace(/\s+/g, "");
  if (!trimmed) return allowEmpty ? null : "Informe as páginas.";
  const parts = trimmed.split(",");
  for (const part of parts) {
    if (!/^(\d+)(-(\d+)?)?$/.test(part)) {
      return `"${part}" não é um intervalo válido. Use o formato 1-3,5,8-.`;
    }
    const [start, end] = part.split("-");
    if (Number(start) < 1) return "As páginas começam em 1.";
    if (end && Number(end) < Number(start)) return `No intervalo "${part}", o fim é menor que o início.`;
  }
  return null;
}

export function validateRangesAgainstTotal(value: string, total: number | undefined): string | null {
  if (!total) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (!trimmed) return null;
  for (const part of trimmed.split(",")) {
    const [start, end] = part.split("-");
    if (Number(start) > total || (end && Number(end) > total)) {
      return `O PDF tem ${total} ${total === 1 ? "página" : "páginas"}; revise "${part}".`;
    }
  }
  return null;
}
