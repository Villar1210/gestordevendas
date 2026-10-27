// src/modules/vendas_kanban/domain/services/trava-por-chave.ts
// Fila em memoria por chave (mesmo desenho do comTravaPorTenant da Roleta).
// Fase B (27/10/2026): "procura card aberto do telefone -> cria se nao achar"
// roda sob trava por tenant+telefone, para mensagens em rajada do mesmo
// cliente (a VIVI chama a cada mensagem) nao criarem 2 cards.
// Limite conhecido: vale dentro de UM processo (o Gestor roda 1 instancia no
// PM2, modo fork). Com varias instancias, trocar por trava no banco
// (pg_advisory_xact_lock).
const filas = new Map<string, Promise<void>>();

export async function comTravaPorChave<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  let liberar!: () => void;
  const minha = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const fim = anterior.then(() => minha);
  filas.set(chave, fim);

  await anterior;
  try {
    return await fn();
  } finally {
    liberar();
    if (filas.get(chave) === fim) {
      filas.delete(chave);
    }
  }
}
