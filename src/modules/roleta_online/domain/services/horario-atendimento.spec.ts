import { dentroDoHorarioDeAtendimento, minutosDesdeAbertura } from './horario-atendimento';

// Datas em UTC: Sao Paulo = UTC-3.
const sp = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 27, h + 3, m));

describe('horario de atendimento (Sao Paulo, 9h-20h)', () => {
  it('limites', () => {
    expect(dentroDoHorarioDeAtendimento(sp(8, 59))).toBe(false);
    expect(dentroDoHorarioDeAtendimento(sp(9, 0))).toBe(true);
    expect(dentroDoHorarioDeAtendimento(sp(19, 59))).toBe(true);
    expect(dentroDoHorarioDeAtendimento(sp(20, 0))).toBe(false);
    expect(dentroDoHorarioDeAtendimento(sp(23, 30))).toBe(false);
  });

  it('minutos desde a abertura', () => {
    expect(minutosDesdeAbertura(sp(9, 15))).toBe(15);
    expect(minutosDesdeAbertura(sp(8, 0))).toBe(-60);
  });
});
