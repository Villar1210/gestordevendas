// src/modules/pdf_tools/infra/services/process-runner.ts
// Execucao segura de binarios externos (soffice/gs/qpdf):
// - spawn SEM shell (argumentos nunca sao interpretados por /bin/sh);
// - timeout com SIGKILL no grupo de processos (soffice cria filhos);
// - stdout/stderr capturados com limite (so para log interno - nunca vao
//   para a resposta HTTP);
// - fila de concorrencia por binario.
import { spawn } from 'child_process';
export { abortedError } from '../../domain/pdf-tools.errors';

const MAX_CAPTURE_BYTES = 8 * 1024;

export interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Cancelado via AbortSignal (cliente desconectou): processo morto. */
  aborted: boolean;
}

export class BinaryNotFoundError extends Error {
  constructor(command: string) {
    super(`Binário não encontrado: ${command}`);
    this.name = 'BinaryNotFoundError';
  }
}

export function runProcess(
  command: string,
  args: string[],
  options: { timeoutMs: number; cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    // Ja cancelado (ex.: enquanto esperava na fila): nem inicia.
    if (options.signal?.aborted) {
      resolve({ code: null, signal: null, stdout: '', stderr: '', timedOut: false, aborted: true });
      return;
    }
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        // Grupo de processos proprio: no timeout matamos o grupo inteiro
        // (soffice.bin e filho do wrapper "soffice").
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let aborted = false;

    const append = (current: string, chunk: Buffer): string =>
      current.length >= MAX_CAPTURE_BYTES ? current : (current + chunk.toString('utf8')).slice(0, MAX_CAPTURE_BYTES);

    const killTree = () => {
      try {
        if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ja terminou */
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree();
    }, options.timeoutMs);
    const onAbort = () => {
      aborted = true;
      killTree();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err.code === 'ENOENT' || err.code === 'EACCES' ? new BinaryNotFoundError(command) : err);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (timedOut || aborted) killTree(); // garante que nenhum neto ficou vivo
      resolve({ code, signal, stdout, stderr, timedOut, aborted });
    });
  });
}

/**
 * Orcamento de tempo de uma execucao: o menor entre o limite proprio do
 * binario e o prazo pedido por quem chamou (ex.: o restante do lote). O
 * relogio comeca ANTES da fila, entao a espera na fila tambem conta.
 */
export function timeBudget(defaultMs: number, requestedMs?: number): () => number {
  if (requestedMs === undefined) return () => defaultMs;
  const started = Date.now();
  return () => Math.max(1, Math.min(defaultMs, requestedMs - (Date.now() - started)));
}

/** Semaforo simples: no maximo `limit` tarefas simultaneas. */
export class ConcurrencyQueue {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}
