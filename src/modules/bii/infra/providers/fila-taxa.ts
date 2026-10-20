// src/modules/bii/infra/providers/fila-taxa.ts
// Fila FIFO com intervalo minimo entre chamadas (politica do Nominatim: no
// maximo 1 requisicao por segundo). UMA instancia global por processo
// (FILA_NOMINATIM), compartilhada pela analise do endereco e pelo job em lote
// - a analise espera no maximo a vez do job (o job pede 1 item por vez).
// Os timers sao unref(): nunca seguram o processo no desligamento.

function dormir(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('Abortado'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', aoAbortar);
      resolve();
    }, ms);
    t.unref?.();
    const aoAbortar = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error('Abortado'));
    };
    signal?.addEventListener('abort', aoAbortar, { once: true });
  });
}

export class FilaTaxa {
  private ultimo = 0;
  private cadeia: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly intervaloMs: number,
    private readonly agora: () => number = () => Date.now(),
  ) {}

  agendar<T>(tarefa: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const executar = async (): Promise<T> => {
      if (signal?.aborted) throw signal.reason ?? new Error('Abortado');
      const espera = this.ultimo + this.intervaloMs - this.agora();
      if (espera > 0) await dormir(espera, signal);
      this.ultimo = this.agora();
      return tarefa();
    };
    const resultado = this.cadeia.then(executar, executar);
    this.cadeia = resultado.catch(() => undefined);
    return resultado;
  }
}

export const FILA_NOMINATIM = new FilaTaxa(1000);
