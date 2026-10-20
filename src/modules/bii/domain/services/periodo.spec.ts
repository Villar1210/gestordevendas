import {
  diasNoPeriodo,
  limiteSuperiorExclusivo,
  mesesDoPeriodo,
  periodoAnterior,
  periodoPadrao,
  validarPeriodo,
} from './periodo';

const d = (a: number, m: number, dia: number) => new Date(a, m - 1, dia);
const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('periodo', () => {
  it('diasNoPeriodo inclusivo', () => {
    expect(diasNoPeriodo(d(2026, 7, 1), d(2026, 7, 1))).toBe(1);
    expect(diasNoPeriodo(d(2026, 7, 1), d(2026, 7, 31))).toBe(31);
    expect(diasNoPeriodo(d(2024, 2, 1), d(2024, 2, 29))).toBe(29);
  });

  it('limite superior exclusivo = meia-noite local do dia seguinte (ate inclusivo)', () => {
    const lim = limiteSuperiorExclusivo(d(2026, 12, 31));
    expect(iso(lim)).toBe('2027-01-01');
    expect(lim.getHours()).toBe(0);
    const ultimoMs = new Date(2026, 11, 31, 23, 59, 59, 999);
    expect(ultimoMs.getTime()).toBeLessThan(lim.getTime());
  });

  it('periodoAnterior tem a mesma duracao e termina na vespera', () => {
    const ant = periodoAnterior(d(2026, 7, 1), d(2026, 7, 31));
    expect(iso(ant.de)).toBe('2026-05-31');
    expect(iso(ant.ate)).toBe('2026-06-30');
    expect(diasNoPeriodo(ant.de, ant.ate)).toBe(31);
  });

  it('periodoAnterior de 1 dia', () => {
    const ant = periodoAnterior(d(2026, 3, 1), d(2026, 3, 1));
    expect(iso(ant.de)).toBe('2026-02-28');
    expect(iso(ant.ate)).toBe('2026-02-28');
  });

  it('periodoPadrao: 6 meses de calendario incluindo o atual', () => {
    const p = periodoPadrao(new Date(2026, 9, 19, 15, 30));
    expect(iso(p.de)).toBe('2026-05-01');
    expect(iso(p.ate)).toBe('2026-10-19');
    expect(mesesDoPeriodo(p.de, p.ate)).toHaveLength(6);
  });

  it('periodoPadrao atravessando o ano', () => {
    expect(iso(periodoPadrao(d(2026, 2, 10)).de)).toBe('2025-09-01');
  });

  it('mesesDoPeriodo inclui meses vazios e atravessa o ano', () => {
    expect(mesesDoPeriodo(d(2025, 11, 15), d(2026, 2, 3))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(mesesDoPeriodo(d(2026, 5, 5), d(2026, 5, 6))).toEqual(['2026-05']);
    expect(mesesDoPeriodo(d(2026, 5, 6), d(2026, 5, 5))).toEqual([]);
  });

  it('validarPeriodo: de > ate', () => {
    expect(validarPeriodo(d(2026, 5, 2), d(2026, 5, 1))).toBe('de_maior_que_ate');
  });

  it('validarPeriodo: exatamente 24 meses passa, 1 dia a mais nao', () => {
    expect(validarPeriodo(d(2024, 1, 1), d(2025, 12, 31))).toBeNull();
    expect(validarPeriodo(d(2024, 1, 1), d(2026, 1, 1))).toBe('periodo_maior_que_maximo');
    expect(validarPeriodo(d(2026, 1, 1), d(2026, 1, 1))).toBeNull();
  });
});
