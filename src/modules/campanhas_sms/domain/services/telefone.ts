// src/modules/campanhas_sms/domain/services/telefone.ts
// Normalizacao de celular brasileiro (dominio puro). SMS so vai para celular:
// 55 + DDD (11..99, sem zero) + 9 digitos comecando com 9. Fixo, numero curto
// ou DDD invalido -> null (o contato e descartado como "invalido").

// DDDs validos no Brasil (Anatel). Lista fechada: evita aceitar "5501..." etc.
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Devolve o celular no formato 55DDD9XXXXXXXX ou null.
 * Aceita "+55 (11) 99999-9999", "11999999999", "011 99999 9999", numero do
 * Excel (5511999999999 como number), etc.
 */
export function normalizarCelularBR(entrada: unknown): string | null {
  if (entrada === null || entrada === undefined) return null;
  let digitos = String(entrada).replace(/\D/g, '');
  if (!digitos) return null;
  // 0 de longa distancia na frente ("011...") e prefixo de operadora nao entram
  if (digitos.length === 12 && digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length === 11) digitos = `55${digitos}`;
  if (digitos.length !== 13 || !digitos.startsWith('55')) return null;
  const ddd = Number(digitos.slice(2, 4));
  if (!DDDS_VALIDOS.has(ddd)) return null;
  if (digitos[4] !== '9') return null;
  return digitos;
}

/** Telefone mascarado para log: 5511*****1234. Nunca logar o numero inteiro. */
export function mascararTelefone(telefone: string | null | undefined): string {
  const t = String(telefone ?? '').replace(/\D/g, '');
  if (t.length < 8) return '***';
  return `${t.slice(0, 4)}${'*'.repeat(Math.max(0, t.length - 8))}${t.slice(-4)}`;
}

/** Formato de exibicao: +55 (11) 99999-1234. */
export function formatarCelular(telefone: string): string {
  if (!/^55\d{11}$/.test(telefone)) return telefone;
  return `+55 (${telefone.slice(2, 4)}) ${telefone.slice(4, 9)}-${telefone.slice(9)}`;
}
