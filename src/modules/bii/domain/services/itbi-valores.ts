// src/modules/bii/domain/services/itbi-valores.ts
// Conversao das celulas da planilha do ITBI para valores tipados. Funcoes
// PURAS. Entrada: o que o leitor de planilha entrega (string | number | Date |
// boolean | null) - formulas ja chegam como o RESULTADO guardado no arquivo.
import { dataUtc } from './data-utc';

export type ValorCelula = string | number | boolean | Date | null | undefined;

// "1.234,56", "R$ 1.234,56", "1234,56", "1234.56", 1234.56 -> 1234.56.
// "1.234" e "1.234.567" (so grupos de milhar) -> 1234 / 1234567.
export function parseNumeroPtBr(valor: ValorCelula): number | null {
  if (valor === null || valor === undefined || typeof valor === 'boolean' || valor instanceof Date) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let s = valor.replace(/R\$/gi, '').replace(/[\s ]/g, '');
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negativo = !negativo;
    s = s.slice(1);
  }
  if (s.includes(',')) {
    // pt-BR: ponto = milhar, virgula = decimal
    if (!/^\d{1,3}(\.\d{3})*,\d+$|^\d+,\d+$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const ANO_MIN = 1990;
const ANO_MAX = 2100;

function dataValida(ano: number, mes: number, dia: number): Date | null {
  if (ano < ANO_MIN || ano > ANO_MAX || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = dataUtc(ano, mes - 1, dia);
  // 31/02 -> 03/03 no Date: recusa
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

// Excel (sistema 1900): dia 1 = 01/01/1900, com o falso 29/02/1900; a conta
// a partir de 30/12/1899 ja compensa isso para datas a partir de 1900-03-01.
export function serialExcelParaData(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80_000) return null;
  const dias = Math.floor(serial);
  const d = new Date(Date.UTC(1899, 11, 30) + dias * 86_400_000);
  return dataValida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// Devolve SEMPRE meia-noite UTC (coluna @db.Date). Aceita: Date do exceljs
// (que representa o dia em UTC), serial do Excel, "dd/mm/aaaa" (com ou sem
// hora depois) e "aaaa-mm-dd".
export function parseDataItbi(valor: ValorCelula): Date | null {
  if (valor === null || valor === undefined || typeof valor === 'boolean') return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return dataValida(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
  }
  if (typeof valor === 'number') return serialExcelParaData(valor);
  const s = valor.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (m) return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  if (/^\d+(\.\d+)?$/.test(s)) return serialExcelParaData(Number(s));
  return null;
}

// Texto limpo: sem caracteres de controle/bidi, espacos colapsados, cortado
// no tamanho da coluna. Vazio -> null. Numero vira texto sem notacao
// cientifica para inteiros (ex.: SQL, CEP, numero).
export function parseTexto(valor: ValorCelula, max: number): string | null {
  if (valor === null || valor === undefined) return null;
  let s: string;
  if (valor instanceof Date) return null;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    s = Number.isInteger(valor) ? valor.toFixed(0) : String(valor);
  } else {
    s = String(valor);
  }
  s = s
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, max) : null;
}

export function parseInteiro(valor: ValorCelula, min: number, max: number): number | null {
  const n = parseNumeroPtBr(valor);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

// Numero dentro de [min, max] arredondado a 'casas' (cabe no Decimal da
// coluna). Fora da faixa -> null.
export function parseDecimal(valor: ValorCelula, min: number, max: number, casas = 2): number | null {
  const n = parseNumeroPtBr(valor);
  if (n === null || n < min || n > max) return null;
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

// "1.Compra e venda", "20.Realização ou integralização de capital " ->
// { codigo: 1, descricao: "Compra e venda" }. So texto -> codigo null. So
// numero -> descricao null.
export function parseCodigoDescricao(valor: ValorCelula, max: number): { codigo: number | null; descricao: string | null } {
  if (typeof valor === 'number') {
    return { codigo: Number.isInteger(valor) && valor >= 0 && valor < 1_000_000 ? valor : null, descricao: null };
  }
  const texto = parseTexto(valor, 500);
  if (!texto) return { codigo: null, descricao: null };
  const m = texto.match(/^(\d{1,6})\s*[.\-–)]\s*(.*)$/);
  if (!m) return { codigo: null, descricao: texto.slice(0, max) };
  const descricao = m[2].trim();
  return { codigo: Number(m[1]), descricao: descricao ? descricao.slice(0, max) : null };
}

// Numero inteiro que perdeu os zeros a esquerda no Excel (SQL 11 digitos, CEP
// 8 digitos): volta a ter 'digitos' casas. Texto e mantido (so os digitos).
export function parseCodigoComZeros(valor: ValorCelula, digitos: number): string | null {
  if (valor === null || valor === undefined || typeof valor === 'boolean' || valor instanceof Date) return null;
  let s: string;
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor) || valor <= 0) return null;
    s = valor.toFixed(0);
  } else {
    s = valor.replace(/\D/g, '');
  }
  if (!s || s.length > digitos) return null;
  return s.padStart(digitos, '0');
}

// Numero do imovel: 99999 e 0 = "sem numero" no arquivo da Prefeitura.
export const NUMEROS_SEM_NUMERO = new Set(['0', '99999']);

export function parseNumeroImovel(valor: ValorCelula): string | null {
  const texto = parseTexto(valor, 20);
  if (!texto) return null;
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '');
  if (/^\d+$/.test(texto) && (digitos === '' || NUMEROS_SEM_NUMERO.has(digitos))) return null;
  if (texto.toUpperCase().replace(/\W/g, '') === 'SN') return null;
  return texto;
}
