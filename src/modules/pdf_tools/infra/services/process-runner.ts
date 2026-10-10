// src/modules/pdf_tools/infra/services/process-runner.ts
// Execucao segura de binarios externos (soffice/gs/qpdf):
// - spawn SEM shell (argumentos nunca sao interpretados por /bin/sh);
// - timeout com SIGKILL no grupo de processos (soffice cria filhos);
// - stdout/stderr capturados com limite (so para log interno - nunca vao
//   para a resposta HTTP);
// - fila de concorrencia por binario.
import { spawn } from 'child_process';

const MAX_CAPTURE_BYTES = 8 * 1024;

export interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
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
  options: { timeoutMs: number; cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
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

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err.code === 'ENOENT' || err.code === 'EACCES' ? new BinaryNotFoundError(command) : err);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) killTree(); // garante que nenhum neto ficou vivo
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
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
