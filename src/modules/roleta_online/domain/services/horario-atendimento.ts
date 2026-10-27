// src/modules/roleta_online/domain/services/horario-atendimento.ts
// Camada de DOMINIO (funcoes puras). Fase B (27/10/2026, Etapa 2 do mapa de
// processos): lead que chega fora do horario das lojas (antes das 9h ou a
// partir das 20h, horario de Sao Paulo) NAO e distribuido na hora - fica na
// Caixa de Entrada (a VIVI atende a noite) e entra no 1o sorteio do dia,
// as 9h. Os alertas de "lead sem corretor" tambem so valem no horario.
// Fixo por enquanto (lojas Direcional 9h-20h); vira configuracao quando
// houver mais de uma empresa com horarios diferentes.
export const HORA_ABERTURA = 9;
export const HORA_FECHAMENTO = 20;
export const FUSO_ATENDIMENTO = 'America/Sao_Paulo';

// Hora e minuto "de parede" em Sao Paulo, sem depender do fuso do servidor.
export function horaEmSaoPaulo(agora: Date): { hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_ATENDIMENTO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? '0');
  return { hora, minuto };
}

export function dentroDoHorarioDeAtendimento(agora: Date = new Date()): boolean {
  const { hora } = horaEmSaoPaulo(agora);
  return hora >= HORA_ABERTURA && hora < HORA_FECHAMENTO;
}

// Minutos desde a abertura de hoje (9h). Negativo antes das 9h.
export function minutosDesdeAbertura(agora: Date = new Date()): number {
  const { hora, minuto } = horaEmSaoPaulo(agora);
  return (hora - HORA_ABERTURA) * 60 + minuto;
}
