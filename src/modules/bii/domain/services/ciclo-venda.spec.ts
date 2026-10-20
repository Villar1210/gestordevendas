import { cicloDias, resumoCiclos } from './ciclo-venda';

const dia = (n: number) => new Date(2026, 0, 1 + n, 10, 0, 0);

describe('ciclo-venda', () => {
  it('cicloDias em dias (fracionario)', () => {
    expect(cicloDias(dia(0), dia(10))).toBe(10);
    expect(cicloDias(new Date(2026, 0, 1, 0), new Date(2026, 0, 1, 12))).toBe(0.5);
    expect(cicloDias(dia(0), dia(0))).toBe(0);
  });

  it('ciclo negativo e descartado', () => {
    expect(cicloDias(dia(5), dia(1))).toBeNull();
    expect(resumoCiclos([{ criadoEm: dia(5), ganhoEm: dia(1) }, { criadoEm: dia(0), ganhoEm: dia(4) }])).toEqual({
      medio: 4,
      mediano: 4,
    });
  });

  it('lista vazia (ou so negativos) -> null', () => {
    expect(resumoCiclos([])).toEqual({ medio: null, mediano: null });
    expect(resumoCiclos([{ criadoEm: dia(5), ganhoEm: dia(1) }])).toEqual({ medio: null, mediano: null });
  });

  it('media e mediana com 1 casa', () => {
    const r = resumoCiclos([
      { criadoEm: dia(0), ganhoEm: dia(1) },
      { criadoEm: dia(0), ganhoEm: dia(2) },
      { criadoEm: dia(0), ganhoEm: dia(10) },
    ]);
    expect(r).toEqual({ medio: 4.3, mediano: 2 });
  });
});
