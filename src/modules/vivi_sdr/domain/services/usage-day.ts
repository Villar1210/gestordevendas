// src/modules/vivi_sdr/domain/services/usage-day.ts
// "Dia" de uso, sem componente de horario, no fuso LOCAL do processo - mesma
// convencao ja usada para campos date-only no restante do projeto (ver
// shared/utils/date-only.util.ts), so que aqui a data nunca vem de input do
// usuario (sempre gerada no momento do processamento da mensagem), entao nao
// ha string para parsear - so a construcao direta via componentes locais.
// NUNCA usar toISOString()/new Date(string) aqui - isso interpretaria em UTC
// e reintroduziria o mesmo bug de fuso ja corrigido em outros pontos do
// projeto (ver CLAUDE.md).
export function getUsageDay(reference: Date = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
}
