// src/modules/roleta_online/domain/services/trava-por-tenant.ts
// Fatia 1 (Atendimento/Roleta): serializa a escolha do corretor por tenant.
//
// Problema: dois leads chegando ao mesmo tempo liam o MESMO
// ultimoCorretorId (round_robin) ou a MESMA contagem de cards (menor_fila)
// e caiam no mesmo corretor. Com a trava, a 2a distribuicao do tenant so
// comeca depois que a 1a gravou o resultado.
//
// Trava em memoria: suficiente porque o backend roda em processo unico no
// pm2 (sem cluster - mesma premissa do RoletaTimeoutScheduler). Se um dia
// rodar com mais de uma instancia, trocar por pg_advisory_xact_lock.
const filas = new Map<string, Promise<void>>();

export async function comTravaPorTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(tenantId) ?? Promise.resolve();
  let liberar!: () => void;
  const minha = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const fim = anterior.then(() => minha);
  filas.set(tenantId, fim);

  await anterior;
  try {
    return await fn();
  } finally {
    liberar();
    // Ninguem entrou depois de mim: limpa para o Map nao crescer.
    if (filas.get(tenantId) === fim) {
      filas.delete(tenantId);
    }
  }
}
