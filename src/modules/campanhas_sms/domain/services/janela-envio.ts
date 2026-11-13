// src/modules/campanhas_sms/domain/services/janela-envio.ts
// Janela de envio (dominio puro): segunda a sabado, de janelaInicio (inclusive)
// ate janelaFim (exclusive), em horario local. Domingo nunca envia.
// diaSemana: 0 = domingo ... 6 = sabado (mesma convencao do Date.getDay()).

export interface MomentoLocal {
  diaSemana: number;
  hora: number;
}

export function dentroDaJanela(momento: MomentoLocal, janelaInicio: number, janelaFim: number): boolean {
  if (momento.diaSemana === 0) return false;
  return momento.hora >= janelaInicio && momento.hora < janelaFim;
}

/** Quantos SMS por rodada do job (o job roda a cada 15 s = 4 por minuto). */
export function envioPorRodada(taxaPorMinuto: number, rodadasPorMinuto = 4): number {
  return Math.max(1, Math.ceil(taxaPorMinuto / rodadasPorMinuto));
}
