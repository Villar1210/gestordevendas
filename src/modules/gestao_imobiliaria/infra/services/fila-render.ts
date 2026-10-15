// src/modules/gestao_imobiliaria/infra/services/fila-render.ts
// Renderizar PDF e decodificar/redimensionar imagens usa muita CPU e memoria
// e roda na thread principal do Node: no maximo UM processamento pesado por
// vez neste processo (os demais esperam na fila), para um book grande nao
// travar o sistema para todo mundo. Compartilhada pelo leitor de PDF e pelo
// normalizador de imagens do book.
let filaRender: Promise<unknown> = Promise.resolve();

export function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaRender.then(tarefa, tarefa);
  filaRender = resultado.catch(() => undefined);
  return resultado;
}
