import {
  calcularConcorrente,
  calcularTipologia,
  concorrentesNoRaio,
  limparTextoCurto,
  limparTextoLongo,
  parseDataLancamento,
  resumirConcorrentes,
  TipologiaEntrada,
  validarFonteUrl,
  validarTipologias,
  validarVendas,
} from './concorrente';
import { dataUtc } from './data-utc';
import { distanciaMetros } from './geo';

const T: TipologiaEntrada = { descricao: '2 dorm.', dormitorios: 2, areaPrivativa: 40, precoDe: 280_000, precoAte: null };

describe('validarTipologias', () => {
  it('aceita lista valida', () => {
    expect(validarTipologias([T, { ...T, precoAte: 300_000 }])).toBeNull();
  });
  it.each([
    [[], 'ao menos uma'],
    [Array.from({ length: 11 }, () => T), 'no máximo 10'],
    [[{ ...T, descricao: '  ' }], 'Descreva a tipologia nº 1'],
    [[T, { ...T, areaPrivativa: 9.9 }], 'tipologia nº 2 deve ficar entre 10 e 1000'],
    [[{ ...T, areaPrivativa: 1001 }], 'entre 10 e 1000'],
    [[{ ...T, areaPrivativa: Number.NaN }], 'entre 10 e 1000'],
    [[{ ...T, precoDe: 9_999 }], 'R$ 10 mil'],
    [[{ ...T, precoDe: 100_000_001 }], 'R$ 10 mil'],
    [[{ ...T, precoAte: 279_999 }], 'não pode ser menor'],
    [[{ ...T, precoAte: 200_000_000 }], 'até R$ 100 milhões'],
    [[{ ...T, dormitorios: 11 }], 'entre 0 e 10'],
    [[{ ...T, dormitorios: 1.5 }], 'entre 0 e 10'],
    [[{ ...T, dormitorios: -1 }], 'entre 0 e 10'],
  ])('rejeita %#', (lista, trecho) => {
    expect(validarTipologias(lista as TipologiaEntrada[])).toContain(trecho);
  });
});

describe('validarVendas', () => {
  it.each([
    [{ totalUnidades: null, unidadesVendidas: null }, null],
    [{ totalUnidades: 100, unidadesVendidas: 100 }, null],
    [{ totalUnidades: null, unidadesVendidas: 10 }, null],
    [{ totalUnidades: 100, unidadesVendidas: 101 }, 'não podem passar'],
    [{ totalUnidades: 0, unidadesVendidas: null }, 'maior que zero'],
    [{ totalUnidades: -1, unidadesVendidas: null }, 'O total de unidades'],
    [{ totalUnidades: 10.5, unidadesVendidas: null }, 'O total de unidades'],
    [{ totalUnidades: 10, unidadesVendidas: 100_001 }, 'As unidades vendidas'],
  ])('%p', (v, trecho) => {
    const r = validarVendas(v);
    if (trecho === null) expect(r).toBeNull();
    else expect(r).toContain(trecho);
  });
});

describe('parseDataLancamento', () => {
  it('YYYY-MM-DD -> meia-noite UTC', () => {
    expect(parseDataLancamento('2026-05-01')?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });
  it.each(['2026-02-31', '01/05/2026', '1989-12-31', '2101-01-01', '2026-13-01', ''])('rejeita %p', (v) => {
    expect(parseDataLancamento(v)).toBeNull();
  });
});

describe('calcularTipologia / calcularConcorrente', () => {
  const agora = new Date('2026-10-20T12:00:00Z');

  it('R$/m2 de e ate; fora da faixa plausivel vira null', () => {
    expect(calcularTipologia({ ...T, precoAte: 320_000 })).toMatchObject({ precoM2De: 7000, precoM2Ate: 8000 });
    expect(calcularTipologia({ ...T, areaPrivativa: 1000, precoDe: 100_000 }).precoM2De).toBeNull(); // 100/m2
    expect(calcularTipologia({ ...T, areaPrivativa: 10, precoDe: 1_000_000 }).precoM2De).toBeNull(); // 100 mil/m2
    expect(calcularTipologia({ ...T, areaPrivativa: 33, precoDe: 250_000 }).precoM2De).toBe(7575.76);
  });

  it('mediana dos "a partir de", faixa min/max (de e ate), precos min/max', () => {
    const tips = [
      calcularTipologia({ ...T, areaPrivativa: 40, precoDe: 280_000, precoAte: 320_000 }), // 7000 / 8000
      calcularTipologia({ ...T, areaPrivativa: 50, precoDe: 400_000, precoAte: null }), // 8000
      calcularTipologia({ ...T, areaPrivativa: 60, precoDe: 540_000, precoAte: null }), // 9000
    ];
    const c = calcularConcorrente(tips, { totalUnidades: null, unidadesVendidas: null, dataLancamento: null }, agora, agora);
    expect(c).toEqual({
      precoM2Mediano: 8000,
      precoM2Min: 7000,
      precoM2Max: 9000,
      precoMin: 280_000,
      precoMax: 540_000,
      percentualVendido: null,
      vendasPorMes: null,
      desatualizado: false,
    });
  });

  it('% vendido e vendas por mes desde o lancamento', () => {
    const tips = [calcularTipologia(T)];
    // ~10 meses entre 2025-12-20 e 2026-10-20 (304 dias / 30.4375)
    const c = calcularConcorrente(
      tips,
      { totalUnidades: 240, unidadesVendidas: 120, dataLancamento: dataUtc(2025, 11, 20) },
      agora,
      agora,
    );
    expect(c.percentualVendido).toBe(50);
    expect(c.vendasPorMes).toBe(12);
  });

  it('lancamento ha menos de 1 mes conta como 1 mes; lancamento futuro nao calcula vendas/mes', () => {
    const tips = [calcularTipologia(T)];
    expect(calcularConcorrente(tips, { totalUnidades: 100, unidadesVendidas: 30, dataLancamento: dataUtc(2026, 9, 10) }, agora, agora).vendasPorMes).toBe(30);
    expect(calcularConcorrente(tips, { totalUnidades: 100, unidadesVendidas: 30, dataLancamento: dataUtc(2026, 11, 1) }, agora, agora).vendasPorMes).toBeNull();
    expect(calcularConcorrente(tips, { totalUnidades: null, unidadesVendidas: 30, dataLancamento: null }, agora, agora)).toMatchObject({ percentualVendido: null, vendasPorMes: null });
  });

  it('sem tipologia valida -> nulos', () => {
    const tips = [calcularTipologia({ ...T, areaPrivativa: 1000, precoDe: 100_000 })];
    expect(calcularConcorrente(tips, { totalUnidades: null, unidadesVendidas: null, dataLancamento: null }, agora, agora)).toMatchObject({
      precoM2Mediano: null,
      precoM2Min: null,
      precoM2Max: null,
      precoMin: 100_000,
    });
    expect(calcularConcorrente([], { totalUnidades: null, unidadesVendidas: null, dataLancamento: null }, agora, agora)).toMatchObject({ precoMin: null, precoMax: null });
  });

  it('desatualizado com mais de 90 dias sem edicao', () => {
    const tips = [calcularTipologia(T)];
    const v = { totalUnidades: null, unidadesVendidas: null, dataLancamento: null };
    expect(calcularConcorrente(tips, v, new Date('2026-07-22T12:00:00Z'), agora).desatualizado).toBe(false); // 90 dias
    expect(calcularConcorrente(tips, v, new Date('2026-07-21T11:00:00Z'), agora).desatualizado).toBe(true);
  });
});

describe('validarFonteUrl', () => {
  it.each(['https://construtora.com.br/empreendimento', 'https://www.zap.com.br/x?y=1'])('aceita %p', (u) => {
    expect(validarFonteUrl(u)).toBeNull();
  });
  it.each([
    ['http://construtora.com.br', 'https://'],
    ['javascript:alert(1)', 'https://'],
    ['https://user:senha@site.com', 'usuário ou senha'],
    ['https://localhost/x', 'link válido'],
    ['https://site.com/a b', 'inválidos'],
    ['naoeurl', 'link válido'],
  ])('rejeita %p', (u, trecho) => {
    expect(validarFonteUrl(u)).toContain(trecho);
  });
});

describe('limpeza de texto', () => {
  it('curto: tira controle/bidi e colapsa espacos', () => {
    expect(limparTextoCurto('  Resid‮encial\n  Vista\t ')).toBe('Resid encial Vista');
    expect(limparTextoCurto('A\u061cB\u2060C\u2064D\ufeffE')).toBe('A B C D E');
  });
  it('longo: mantem quebra de linha simples, no maximo uma linha em branco', () => {
    expect(limparTextoLongo('linha 1\r\nlinha 2\n\n\n\nlinha 3​ ')).toBe('linha 1\nlinha 2\n\nlinha 3');
  });
});

describe('concorrentesNoRaio / resumirConcorrentes', () => {
  const centro = { lat: -23.59, lng: -46.56 };
  const mk = (nome: string, dLat: number, m2: number | null, unidades: number | null) => ({
    nome,
    lat: centro.lat + dLat,
    lng: centro.lng,
    totalUnidades: unidades,
    calculado: { precoM2Mediano: m2 },
  });

  it('filtra pelo raio, ordena por distancia e limita', () => {
    const itens = [mk('b', 0.005, 8000, 100), mk('a', 0.001, 7000, null), mk('fora', 0.02, 9000, 50)];
    const r = concorrentesNoRaio(itens, centro, 1000, distanciaMetros);
    expect(r.map((c) => c.nome)).toEqual(['a', 'b']);
    expect(r[0].distanciaMetros).toBe(111);
    expect(concorrentesNoRaio(itens, centro, 1000, distanciaMetros, 1).map((c) => c.nome)).toEqual(['a']);
  });

  it('resumo: mediana dos concorrentes com R$/m2 e soma das unidades conhecidas', () => {
    expect(resumirConcorrentes([mk('a', 0, 7000, 100), mk('b', 0, 9000, null), mk('c', 0, null, 50)])).toEqual({
      quantidade: 3,
      precoM2Mediano: 8000,
      unidadesTotais: 150,
    });
    expect(resumirConcorrentes([])).toEqual({ quantidade: 0, precoM2Mediano: null, unidadesTotais: null });
  });
});
