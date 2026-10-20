import { arredondar1, media, mediana, percentual, soma } from './estatistica';

describe('estatistica', () => {
  it('soma/media com lista vazia', () => {
    expect(soma([])).toBe(0);
    expect(media([])).toBeNull();
  });

  it.each([
    [[], null],
    [[7], 7],
    [[3, 1, 2], 2],
    [[4, 1, 3, 2], 2.5],
    [[5, 5, 5, 1], 5],
    [[-2, 10], 4],
  ])('mediana(%j) = %p', (xs, esperado) => {
    expect(mediana(xs)).toBe(esperado);
  });

  it('mediana nao altera o array recebido', () => {
    const xs = [3, 1, 2];
    mediana(xs);
    expect(xs).toEqual([3, 1, 2]);
  });

  it('media simples', () => {
    expect(media([1, 2, 3, 4])).toBe(2.5);
  });

  it.each([
    [1, 3, 33.3],
    [2, 3, 66.7],
    [5, 5, 100],
    [0, 10, 0],
    [3, 0, null],
    [3, -1, null],
    [1, Number.NaN, null],
    [Number.POSITIVE_INFINITY, 2, null],
  ])('percentual(%p, %p) = %p', (parte, total, esperado) => {
    expect(percentual(parte, total)).toBe(esperado);
  });

  it('arredondar1', () => {
    expect(arredondar1(12.345)).toBe(12.3);
    expect(arredondar1(12.35)).toBe(12.4);
  });
});

describe('estatistica - percentil (interpolacao linear)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { percentil, mediana } = require('./estatistica');

  it('lista vazia -> null', () => {
    expect(percentil([], 0.5)).toBeNull();
  });

  it('p25/p50/p75 de 1..5 e 1..4 (regra do percentile_cont)', () => {
    expect(percentil([5, 1, 3, 2, 4], 0.25)).toBe(2);
    expect(percentil([5, 1, 3, 2, 4], 0.75)).toBe(4);
    expect(percentil([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(percentil([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(percentil([7], 0.25)).toBe(7);
  });

  it('p50 = mediana', () => {
    for (const v of [[1], [1, 2], [3, 1, 2], [10, 2, 8, 4]]) expect(percentil(v, 0.5)).toBe(mediana(v));
  });

  it('p fora de [0,1] lanca erro; nao altera a lista', () => {
    const v = [3, 1, 2];
    expect(() => percentil(v, 1.5)).toThrow();
    percentil(v, 0.5);
    expect(v).toEqual([3, 1, 2]);
  });
});
