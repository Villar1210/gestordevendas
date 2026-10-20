// src/modules/bii/domain/services/data-utc.ts
// Datas "date-only" das colunas @db.Date do ITBI (ItbiTransacao.dataTransacao).
// O Postgres guarda so o dia; o Prisma envia/recebe a parte de DATA do valor em
// UTC. Por isso aqui toda data-only e MEIA-NOITE UTC (Date.UTC), independente
// do fuso do servidor - nunca new Date(ano, mes, dia) (local) nem
// new Date("YYYY-MM-DD") direto. Funcoes PURAS.

export function dataUtc(ano: number, mesIndex: number, dia: number): Date {
  return new Date(Date.UTC(ano, mesIndex, dia));
}

// Hoje (dia de calendario LOCAL do servidor, ex. America/Sao_Paulo) como
// meia-noite UTC.
export function hojeUtc(agora: Date): Date {
  return dataUtc(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

export function somarDiasUtc(data: Date, dias: number): Date {
  return dataUtc(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias);
}

export function formatarDataUtc(data: Date): string {
  const m = String(data.getUTCMonth() + 1).padStart(2, '0');
  const d = String(data.getUTCDate()).padStart(2, '0');
  return `${data.getUTCFullYear()}-${m}-${d}`;
}

export function chaveMesUtc(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Periodo da analise: os ultimos N meses de calendario terminando no mes de
// "ate" (inclusive): de = dia 1 de (mes de ate - (N-1)).
export function periodoDeMeses(ate: Date, meses: number): { de: Date; ate: Date } {
  return { de: dataUtc(ate.getUTCFullYear(), ate.getUTCMonth() - (meses - 1), 1), ate };
}

// Todos os meses YYYY-MM do periodo, em ordem, inclusive os sem dado.
export function mesesDoPeriodoUtc(de: Date, ate: Date): string[] {
  const saida: string[] = [];
  let cursor = dataUtc(de.getUTCFullYear(), de.getUTCMonth(), 1);
  const fim = dataUtc(ate.getUTCFullYear(), ate.getUTCMonth(), 1);
  while (cursor.getTime() <= fim.getTime()) {
    saida.push(chaveMesUtc(cursor));
    cursor = dataUtc(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  }
  return saida;
}
