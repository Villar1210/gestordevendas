// src/modules/bii/domain/services/estatistica.ts
// Funcoes PURAS (sem Nest/Prisma). null = "sem base para calcular" (lista
// vazia, divisao por zero) - o frontend mostra "-" nesses casos.

export function arredondar1(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function soma(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0);
}

export function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return soma(valores) / valores.length;
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

// parte / total * 100, com 1 casa. total <= 0 (ou nao finito) -> null.
export function percentual(parte: number, total: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(parte) || total <= 0) return null;
  return arredondar1((parte / total) * 100);
}
