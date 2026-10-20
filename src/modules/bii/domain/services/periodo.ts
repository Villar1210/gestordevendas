// src/modules/bii/domain/services/periodo.ts
// Datas "date-only" representadas como meia-noite LOCAL (mesma convencao de
// shared/utils/date-only.util.ts - parseDateOnly). Toda aritmetica usa o
// construtor new Date(ano, mes, dia), que trabalha no fuso local e nao sofre
// com o bug de UTC das strings date-only. Funcoes PURAS.

export const MAX_MESES_PERIODO = 24;

const MS_DIA = 24 * 60 * 60 * 1000;

export function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

export function somarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, data.getDate());
}

// Quantidade de dias de calendario entre de e ate, inclusive (de=ate -> 1).
export function diasNoPeriodo(de: Date, ate: Date): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / MS_DIA) + 1;
}

// "ate" e inclusivo ate o fim do dia local: as consultas usam
// ocorridoEm < inicio do dia seguinte (equivale a <= 23:59:59.999).
export function limiteSuperiorExclusivo(ate: Date): Date {
  return somarDias(inicioDoDia(ate), 1);
}

// Periodo padrao: os ultimos 6 meses de calendario, incluindo o mes atual
// (do dia 1 de 5 meses atras ate hoje) - 6 barras no grafico de VGV por mes.
export function periodoPadrao(hoje: Date): { de: Date; ate: Date } {
  return { de: new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1), ate: inicioDoDia(hoje) };
}

export type ErroPeriodo = 'de_maior_que_ate' | 'periodo_maior_que_maximo' | null;

// Maximo de 24 meses: ate tem de ser ANTES de de + 24 meses
// (01/01/2024..31/12/2025 passa; 01/01/2024..01/01/2026 nao).
export function validarPeriodo(de: Date, ate: Date): ErroPeriodo {
  const d = inicioDoDia(de);
  const a = inicioDoDia(ate);
  if (d.getTime() > a.getTime()) return 'de_maior_que_ate';
  if (a.getTime() >= somarMeses(d, MAX_MESES_PERIODO).getTime()) return 'periodo_maior_que_maximo';
  return null;
}

// Periodo imediatamente anterior, com a MESMA quantidade de dias.
// Ex.: 01/07..31/07 (31 dias) -> 31/05..30/06.
export function periodoAnterior(de: Date, ate: Date): { de: Date; ate: Date } {
  const dias = diasNoPeriodo(de, ate);
  return { de: somarDias(inicioDoDia(de), -dias), ate: somarDias(inicioDoDia(de), -1) };
}

export function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// Todos os meses (YYYY-MM) tocados pelo periodo, em ordem, inclusive os que
// nao tiverem nenhum dado.
export function mesesDoPeriodo(de: Date, ate: Date): string[] {
  if (inicioDoDia(de).getTime() > inicioDoDia(ate).getTime()) return [];
  const meses: string[] = [];
  let cursor = new Date(de.getFullYear(), de.getMonth(), 1);
  const fim = new Date(ate.getFullYear(), ate.getMonth(), 1);
  while (cursor.getTime() <= fim.getTime()) {
    meses.push(chaveMes(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return meses;
}
