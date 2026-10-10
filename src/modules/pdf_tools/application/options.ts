// src/modules/pdf_tools/application/options.ts
// Validacao manual das opcoes das ferramentas (campo multipart "options" em
// JSON ou corpo JSON do /create). Todas as falhas viram
// PdfToolsError(INVALID_INPUT) -> HTTP 400, com mensagem em portugues.
import { invalidInput } from '../domain/pdf-tools.errors';

export type RawOptions = Record<string, unknown>;

/** Aceita objeto ja parseado, string JSON, ou vazio ({}). */
export function parseOptions(raw: unknown): RawOptions {
  if (raw === undefined || raw === null || raw === '') return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw invalidInput('Opções inválidas: o campo "options" precisa ser um JSON válido.');
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidInput('Opções inválidas: o campo "options" precisa ser um objeto JSON.');
  }
  return value as RawOptions;
}

export function readEnum<T extends string | number>(
  options: RawOptions,
  key: string,
  allowed: readonly T[],
  label: string,
  fallback?: T,
): T {
  const value = options[key];
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw invalidInput(`Informe ${label}.`);
  }
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw invalidInput(`Valor inválido para ${label}. Use: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function readBoolean(options: RawOptions, key: string, label: string, fallback: boolean): boolean {
  const value = options[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw invalidInput(`Valor inválido para ${label}: use true ou false.`);
  }
  return value;
}

export function readNumber(
  options: RawOptions,
  key: string,
  label: string,
  limits: { min: number; max: number; integer?: boolean },
  fallback?: number,
): number {
  const value = options[key];
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw invalidInput(`Informe ${label}.`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || (limits.integer && !Number.isInteger(value))) {
    throw invalidInput(`Valor inválido para ${label}: informe um número${limits.integer ? ' inteiro' : ''}.`);
  }
  if (value < limits.min || value > limits.max) {
    throw invalidInput(`${capitalize(label)} deve estar entre ${limits.min} e ${limits.max}.`);
  }
  return value;
}

export function readString(
  options: RawOptions,
  key: string,
  label: string,
  limits: { min: number; max: number },
  required = true,
): string | undefined {
  const value = options[key];
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw invalidInput(`Informe ${label}.`);
  }
  if (typeof value !== 'string') {
    throw invalidInput(`Valor inválido para ${label}: informe um texto.`);
  }
  if (value.length < limits.min || value.length > limits.max) {
    throw invalidInput(
      limits.min > 0
        ? `${capitalize(label)} deve ter entre ${limits.min} e ${limits.max} caracteres.`
        : `${capitalize(label)} deve ter no máximo ${limits.max} caracteres.`,
    );
  }
  return value;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

