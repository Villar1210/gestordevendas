import {
  momentoSP,
  horariosNaJanela,
  proximoHorario,
  embaralhar,
  proximoDaFila,
  horarioValido,
} from './fila-sorteio';

describe('fila-sorteio', () => {
  it('momentoSP converte para o horario de Sao Paulo (UTC-3)', () => {
    // 2026-10-05 01:30 UTC = 2026-10-04 22:30 em SP (domingo)
    expect(momentoSP(new Date('2026-10-05T01:30:00Z'))).toEqual({ dia: '2026-10-04', minutos: 22 * 60 + 30, diaSemana: 0 });
    // 2026-10-05 12:05 UTC = 09:05 em SP (segunda)
    expect(momentoSP(new Date('2026-10-05T12:05:00Z'))).toEqual({ dia: '2026-10-05', minutos: 9 * 60 + 5, diaSemana: 1 });
  });

  it('valida horarios HH:MM', () => {
    expect(horarioValido('09:00')).toBe(true);
    expect(horarioValido('23:59')).toBe(true);
    expect(horarioValido('24:00')).toBe(false);
    expect(horarioValido('9:00')).toBe(false);
  });

  it('horariosNaJanela so devolve horarios alcancados ha no maximo 60 min', () => {
    const h = ['14:00', '09:00', '09:00', 'xx'];
    expect(horariosNaJanela(h, 8 * 60 + 59)).toEqual([]);
    expect(horariosNaJanela(h, 9 * 60)).toEqual(['09:00']);
    expect(horariosNaJanela(h, 10 * 60)).toEqual(['09:00']);
    expect(horariosNaJanela(h, 10 * 60 + 1)).toEqual([]);
    expect(horariosNaJanela(h, 14 * 60 + 30)).toEqual(['14:00']);
  });

  it('proximoHorario devolve o proximo de hoje ou nulo', () => {
    expect(proximoHorario(['14:00', '09:00'], 8 * 60)).toBe('09:00');
    expect(proximoHorario(['14:00', '09:00'], 9 * 60)).toBe('14:00');
    expect(proximoHorario(['14:00', '09:00'], 15 * 60)).toBeNull();
  });

  it('embaralhar mantem todos os itens e usa o gerador informado', () => {
    const r = embaralhar(['a', 'b', 'c', 'd'], () => 0);
    expect([...r].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(r).toEqual(['b', 'c', 'd', 'a']);
    expect(embaralhar([])).toEqual([]);
  });

  it('embaralhar com gerador real produz ordens diferentes (nao fixa)', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 50; i++) vistos.add(embaralhar(['a', 'b', 'c', 'd']).join(''));
    expect(vistos.size).toBeGreaterThan(5);
  });

  it('proximoDaFila pula offline/excluidos sem mudar a ordem', () => {
    const fila = [
      { userId: 'c', posicao: 3 },
      { userId: 'a', posicao: 1 },
      { userId: 'b', posicao: 2 },
    ];
    expect(proximoDaFila(fila, new Set(['a', 'b', 'c']))).toBe('a');
    expect(proximoDaFila(fila, new Set(['b', 'c']))).toBe('b');
    expect(proximoDaFila(fila, new Set(['a', 'b', 'c']), new Set(['a']))).toBe('b');
    expect(proximoDaFila(fila, new Set())).toBeNull();
  });
});
