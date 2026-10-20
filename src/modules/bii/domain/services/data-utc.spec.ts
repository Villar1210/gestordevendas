import { dataUtc, formatarDataUtc, hojeUtc, mesesDoPeriodoUtc, periodoDeMeses, somarDiasUtc } from './data-utc';

describe('data-utc', () => {
  it('periodoDeMeses: N meses de calendario terminando no mes de "ate"', () => {
    const ate = dataUtc(2026, 8, 7);
    expect(formatarDataUtc(periodoDeMeses(ate, 12).de)).toBe('2025-10-01');
    expect(formatarDataUtc(periodoDeMeses(ate, 6).de)).toBe('2026-04-01');
    expect(mesesDoPeriodoUtc(periodoDeMeses(ate, 12).de, ate)).toHaveLength(12);
    expect(mesesDoPeriodoUtc(periodoDeMeses(ate, 36).de, ate)).toHaveLength(36);
  });

  it('hojeUtc usa o dia LOCAL e devolve meia-noite UTC', () => {
    const local = new Date(2026, 9, 20, 23, 30);
    expect(hojeUtc(local).toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('somarDiasUtc atravessa mes', () => {
    expect(formatarDataUtc(somarDiasUtc(dataUtc(2026, 0, 31), 1))).toBe('2026-02-01');
  });
});
