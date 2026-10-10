// src/modules/pdf_tools/application/batch-processor.ts
// Lote comum das ferramentas "1 arquivo -> 1 arquivo" (comprimir, Office,
// girar, numerar, marca d'agua, proteger, desbloquear, extrair texto).
//
// Regras (iguais para todas):
// - 1 arquivo: o caso de uso devolve exatamente o resultado individual
//   (mesmo nome, mesmo meta, mesmas mensagens de erro de sempre);
// - prazo TOTAL do lote (PDF_TOOLS_LIMITS.batchDeadlineMs, 240s; o nginx
//   corta em 300s): checado antes de iniciar cada arquivo; o restante vai
//   para o processamento do arquivo (timeoutMs dos binarios). Estourou ->
//   BATCH_TIMEOUT (422) dizendo quantos ja tinham sido processados;
// - varios: 1) valida TODOS (ex.: conta paginas -> PDF protegido/corrompido)
//   antes de processar qualquer um; 2) processa UM POR VEZ (memoria);
//   3) qualquer erro aborta o lote com mensagem que nomeia o arquivo;
//   4) resultados viram um ZIP com os mesmos nomes do individual,
//   desambiguados ("x_comprimido.pdf", "x_comprimido (2).pdf");
// - tetos: soma de paginas do lote (weight(), checado depois de validar
//   TODOS e antes de processar o primeiro) e soma da saida (150 MB no lote,
//   120 MB com 1 arquivo) - TOO_LARGE nomeando onde estourou;
// - cancelamento: AbortSignal (cliente desconectou) checado antes de cada
//   arquivo e repassado aos binarios -> PdfToolsError ABORTED (silencioso).
import { Inject, Injectable, Optional } from '@nestjs/common';
import { abortedError, invalidInput, PdfToolsError } from '../domain/pdf-tools.errors';
import { MB, PDF_TOOLS_LIMITS } from '../domain/pdf-tools.limits';
import { uniqueFileNames } from '../domain/file-name';
import { IZipBuilder } from '../domain/services/zip-builder.interface';
import { CONTENT_TYPES, InputFile, PdfToolResult, PdfToolsMeta } from './pdf-tool.types';

export interface BatchSteps<V, R> {
  /** Checagem barata de cada arquivo, feita para TODOS antes de processar. */
  validate?: (file: InputFile, index: number) => Promise<V>;
  /** Paginas do arquivo (a partir do validate) - somadas contra batchMaxPagesTotal. */
  weight?: (validated: V) => number;
  /**
   * Processamento de um arquivo (recebe o valor devolvido por validate).
   * budget: repassar aos servicos que aceitam (soffice/gs/qpdf). timeoutMs
   * = tempo que ainda resta do prazo do lote (so no lote); signal =
   * cancelamento. undefined quando nao ha nenhum dos dois.
   */
  process: (file: InputFile, validated: V, index: number, budget?: RunBudget) => Promise<R>;
  /** Bytes de saida de um resultado (padrao: result.data.length, se houver). */
  outputBytes?: (result: R) => number;
}

export interface RunBudget {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface BatchRunOptions {
  signal?: AbortSignal;
}

function defaultOutputBytes(result: unknown): number {
  const data = (result as { data?: unknown } | null)?.data;
  return Buffer.isBuffer(data) ? data.length : 0;
}

/** Relogio injetavel (testes usam um relogio falso). */
export const PDF_TOOLS_CLOCK = 'PDF_TOOLS_CLOCK';
export type Clock = () => number;

export function batchTimeoutError(processed: number, total: number): PdfToolsError {
  const minutes = Math.round(PDF_TOOLS_LIMITS.batchDeadlineMs / 60_000);
  return new PdfToolsError(
    'BATCH_TIMEOUT',
    `O lote demorou mais que o limite (${minutes} min). Envie menos arquivos por vez — já tinham sido processados ${processed} de ${total}.`,
  );
}

export function batchPagesError(pages: number, fileName: string): PdfToolsError {
  const max = PDF_TOOLS_LIMITS.batchMaxPagesTotal.toLocaleString('pt-BR');
  return new PdfToolsError(
    'TOO_LARGE',
    `Os arquivos somam mais de ${max} páginas, o limite por lote (passou em "${fileName}", com ${pages.toLocaleString('pt-BR')} no total). Envie menos arquivos por vez.`,
  );
}

export function batchOutputError(fileName: string): PdfToolsError {
  return new PdfToolsError(
    'TOO_LARGE',
    `O resultado do lote passa de ${PDF_TOOLS_LIMITS.batchMaxOutputBytes / MB} MB (estourou em "${fileName}"). Envie menos arquivos por vez.`,
  );
}

export function singleOutputError(): PdfToolsError {
  return new PdfToolsError('TOO_LARGE', `O arquivo gerado passa do limite de ${PDF_TOOLS_LIMITS.maxOutputBytes / MB} MB.`);
}

/** Erro de um arquivo do lote -> mesma categoria, mensagem com o nome. */
export function batchFileError(error: unknown, fileName: string): unknown {
  if (!(error instanceof PdfToolsError)) return error;
  const name = `"${fileName}"`;
  switch (error.code) {
    case 'ABORTED':
    case 'BATCH_TIMEOUT':
      return error; // dizem respeito ao lote, nao ao arquivo
    case 'ENCRYPTED_PDF':
      return new PdfToolsError(
        'ENCRYPTED_PDF',
        `${name} está protegido por senha. Remova-o da lista ou use a ferramenta Desbloquear PDF primeiro.`,
      );
    case 'WRONG_PASSWORD':
      return new PdfToolsError(
        'WRONG_PASSWORD',
        `Senha incorreta para ${name}. No lote, a mesma senha é usada em todos os arquivos.`,
      );
    case 'TOOL_UNAVAILABLE':
      return error; // nao depende do arquivo
    case 'INVALID_INPUT':
      if (/^Não foi possível ler o PDF/.test(error.message)) {
        return invalidInput(`Não foi possível ler ${name}. Verifique se o arquivo não está corrompido.`);
      }
      return new PdfToolsError(error.code, `${name}: ${error.message}`);
    default:
      return new PdfToolsError(error.code, `${name}: ${error.message}`);
  }
}

export function assertBatchCount(files: InputFile[], max: number, noun = 'arquivos'): void {
  if (!files || files.length === 0) throw invalidInput('Envie pelo menos 1 arquivo.');
  if (files.length > max) throw invalidInput(`Envie no máximo ${max} ${noun} por vez.`);
}

function sum(values: (number | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

@Injectable()
export class BatchProcessor {
  private readonly now: Clock;

  constructor(
    @Inject('IZipBuilder') private readonly zip: IZipBuilder,
    @Optional() @Inject(PDF_TOOLS_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? Date.now;
  }

  /**
   * Valida todos e processa um por vez. Com 1 arquivo os erros saem
   * intactos (contrato antigo); com varios, nomeiam o arquivo.
   */
  async run<V, R>(files: InputFile[], steps: BatchSteps<V, R>, options: BatchRunOptions = {}): Promise<R[]> {
    const { signal } = options;
    const batch = files.length > 1;
    const deadline = this.now() + PDF_TOOLS_LIMITS.batchDeadlineMs;
    const remaining = () => deadline - this.now();
    const checkAbort = () => {
      if (signal?.aborted) throw abortedError();
    };
    const guard = async <T>(file: InputFile, task: () => Promise<T>): Promise<T> => {
      try {
        return await task();
      } catch (error) {
        if (signal?.aborted) throw abortedError(); // falha causada pelo cancelamento
        throw batch ? batchFileError(error, file.originalname) : error;
      }
    };

    const validated: V[] = [];
    let pages = 0;
    for (let i = 0; i < files.length; i++) {
      checkAbort();
      const validate = steps.validate;
      const value = validate ? await guard(files[i], () => validate(files[i], i)) : (undefined as V);
      validated.push(value);
      if (steps.weight) {
        pages += steps.weight(value);
        if (batch && pages > PDF_TOOLS_LIMITS.batchMaxPagesTotal) throw batchPagesError(pages, files[i].originalname);
      }
    }

    const results: R[] = [];
    let output = 0;
    const outputBytes = steps.outputBytes ?? defaultOutputBytes;
    for (let i = 0; i < files.length; i++) {
      checkAbort();
      // Prazo so vale no lote: 1 arquivo segue so com o limite de cada binario.
      if (batch && remaining() <= 0) throw batchTimeoutError(i, files.length);
      let result: R;
      try {
        const budget: RunBudget | undefined =
          batch || signal ? { ...(batch ? { timeoutMs: remaining() } : {}), ...(signal ? { signal } : {}) } : undefined;
        result = await guard(files[i], () => steps.process(files[i], validated[i], i, budget));
      } catch (error) {
        // Binario morto pelo prazo do lote (ou o prazo acabou durante o
        // arquivo): a causa real e o lote, nao o arquivo.
        if (batch && remaining() <= 0 && !(error instanceof PdfToolsError && error.code === 'ABORTED')) {
          throw batchTimeoutError(i, files.length);
        }
        throw error;
      }
      validated[i] = undefined as V; // libera o que a validacao guardou
      output += outputBytes(result);
      if (batch && output > PDF_TOOLS_LIMITS.batchMaxOutputBytes) throw batchOutputError(files[i].originalname);
      if (!batch && output > PDF_TOOLS_LIMITS.maxOutputBytes) throw singleOutputError();
      results.push(result);
    }
    return results;
  }

  /**
   * Junta os resultados individuais num ZIP. Meta: files + somas de
   * originalSize/resultSize (do conteudo, nao do zip) e das chaves
   * numericas pedidas em sumKeys + extra.
   */
  zipResults(results: PdfToolResult[], zipName: string, sumKeys: string[] = [], extra: PdfToolsMeta = {}): PdfToolResult {
    const names = uniqueFileNames(results.map((r) => r.fileName));
    const data = this.zip.build(results.map((r, i) => ({ name: names[i], data: r.data })));
    const meta: PdfToolsMeta = { files: results.length };
    for (const key of sumKeys) meta[key] = sum(results.map((r) => r.meta[key] as number | undefined));
    meta.originalSize = sum(results.map((r) => r.meta.originalSize as number | undefined));
    meta.resultSize = sum(results.map((r) => r.data.length));
    return { data, fileName: zipName, contentType: CONTENT_TYPES.zip, meta: { ...meta, ...extra } };
  }
}
