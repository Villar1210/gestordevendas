// src/shared/utils/date-only.util.ts
// Strings "date-only" (formato "YYYY-MM-DD", sem componente de horario) sao
// as unicas manipuladas por esta funcao. Datas COM horario (ISO completo,
// ex: "2026-07-25T14:30:00.000Z") ja tem fuso explicito e devem continuar
// usando new Date() normalmente - nao passar por aqui.
//
// Bug que isso evita: `new Date("2026-07-25")` (string sem horario) e
// interpretado pelo JavaScript como meia-noite UTC (0), NAO meia-noite no
// fuso local do processo - ao formatar de volta num fuso negativo (ex:
// Brasil, UTC-3), o resultado exibido fica um dia a menos ("24/07"). Ver
// CLAUDE.md, secao sobre esse bug, descoberto na Fatia 4 do modulo
// Financeiro (Gestao Imobiliaria).

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Recebe uma string "YYYY-MM-DD" (o formato que <input type="date"> e
// class-validator @IsDateString() aceitam) e retorna um Date representando
// meia-noite no horario LOCAL do processo Node - nao UTC.
export function parseDateOnly(dateString: string): Date {
  const match = DATE_ONLY_PATTERN.exec(dateString);
  if (!match) {
    throw new Error(`parseDateOnly: string invalida, esperado "YYYY-MM-DD", recebido "${dateString}".`);
  }
  const [, year, month, day] = match;
  // new Date(year, monthIndex, day) usa o fuso LOCAL do processo (ao
  // contrario de new Date(string), que so usa UTC para strings date-only) -
  // e exatamente essa a diferenca que corrige o bug.
  return new Date(Number(year), Number(month) - 1, Number(day));
}

// Inverso de parseDateOnly: formata um Date de volta para "YYYY-MM-DD"
// usando os componentes LOCAIS (getFullYear/getMonth/getDate) - nunca
// toISOString(), que converte para UTC primeiro e reintroduziria o mesmo
// bug (um dia a menos em fusos negativos).
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
