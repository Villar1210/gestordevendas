import { VERSOES_MCMV, VERSOES_MUNICIPAIS, versaoVigente } from './parametros-habitacionais';
import { avaliarTipologia, calcularFinanciamento, faixaPorPreco, faixaPorRenda, parcelaPrice, Premissas, PREMISSAS_PADRAO } from './viabilidade';

const MUN = VERSOES_MUNICIPAIS[0];
const MCMV = VERSOES_MCMV[0];
const P = PREMISSAS_PADRAO;
const tip = (preco: number, area = 40) => ({ descricao: 'x', areaPrivativa: area, preco });

describe('parametros vigentes', () => {
  it('valores oficiais do Decreto 64.895/2026 e do MCMV de abr/2026', () => {
    expect(MUN.categorias.map((c) => [c.rotulo, c.rendaMax, c.tetoVenda])).toEqual([
      ['HIS-1', 4863, 276102.2],
      ['HIS-2', 9726, 383636.74],
      ['HMP', 16210, 537672.71],
    ]);
    expect(MCMV.faixas.map((f) => [f.rotulo, f.rendaMax, f.tetoImovel])).toEqual([
      ['Faixa 1', 3200, 275000],
      ['Faixa 2', 5000, 275000],
      ['Faixa 3', 9600, 400000],
      ['Faixa 4', 13000, 600000],
    ]);
  });
  it('versaoVigente escolhe pela data; antes da primeira vale a primeira', () => {
    const vs = [{ vigenteDesde: '2026-01-06', n: 1 }, { vigenteDesde: '2027-01-05', n: 2 }];
    expect(versaoVigente(vs, '2026-10-21').n).toBe(1);
    expect(versaoVigente(vs, '2027-01-05').n).toBe(2);
    expect(versaoVigente(vs, '2020-01-01').n).toBe(1);
  });
});

describe('Tabela Price', () => {
  it('confere com calculo independente (R$ 191.200, 7% a.a., 420 meses = R$ 1.192,79)', () => {
    expect(parcelaPrice(191_200, 7, 420)).toBeCloseTo(1192.79, 2);
  });
  it('juros zero = divisao simples; valor zero = 0', () => {
    expect(parcelaPrice(42_000, 0, 420)).toBe(100);
    expect(parcelaPrice(0, 7, 420)).toBe(0);
  });
});

describe('faixas MCMV', () => {
  it.each([
    [3200, 'F1'],
    [3200.01, 'F2'],
    [5000, 'F2'],
    [5000.01, 'F3'],
    [9600, 'F3'],
    [13000, 'F4'],
    [13000.01, null],
  ])('renda %p -> %p', (renda, faixa) => {
    expect(faixaPorRenda(renda, MCMV)?.faixa ?? null).toBe(faixa);
  });
  it.each([
    [275000, 'F1'],
    [275000.01, 'F3'],
    [400000, 'F3'],
    [600000, 'F4'],
    [600000.01, null],
  ])('preco %p -> faixa minima %p', (preco, faixa) => {
    expect(faixaPorPreco(preco, MCMV)?.faixa ?? null).toBe(faixa);
  });
});

describe('renda necessaria (faixas que cobrem o preco, com piso)', () => {
  it('R$ 239 mil: F1 cobre o preco mas a renda (5,25%) passa da F1 -> F2 com 7%', () => {
    const f = calcularFinanciamento(239_000, P, MCMV);
    expect(f.faixa?.faixa).toBe('F2');
    expect(f.juros).toBe(7);
    expect(f.parcela).toBeCloseTo(1192.79, 2);
    expect(f.renda).toBeCloseTo(3975.98, 2);
    expect(f.pelaPiso).toBe(false);
  });
  it('R$ 410 mil (padrao): so a F4 cobre; parcela pede R$ 9.421 -> renda minima = piso da F4', () => {
    const f = calcularFinanciamento(410_000, P, MCMV);
    expect(f.faixa?.faixa).toBe('F4');
    expect(f.rendaPelaParcela).toBeCloseTo(9421.0, 2);
    expect(f.renda).toBe(9600.01);
    expect(f.pelaPiso).toBe(true);
  });
  it('R$ 290 mil com 40% de entrada: F3 com o piso de R$ 5.000,01', () => {
    const f = calcularFinanciamento(290_000, { ...P, entradaPercentual: 40 }, MCMV);
    expect(f.faixa?.faixa).toBe('F3');
    expect(f.rendaPelaParcela).toBeCloseTo(4064.79, 2);
    expect(f.renda).toBe(5000.01);
  });
  it('juros fixo 0%: R$ 350 mil enquadra na F3 (nao na F1, cujo teto nao cobre)', () => {
    const f = calcularFinanciamento(350_000, { ...P, jurosAnual: 0 }, MCMV);
    expect(f.faixa?.faixa).toBe('F3');
    expect(f.juros).toBe(0);
  });
  it('renda passa da F4 em todas as faixas que cobrem -> fora do MCMV, juros SBPE', () => {
    const f = calcularFinanciamento(590_000, { ...P, entradaPercentual: 0 }, MCMV);
    expect(f.faixa).toBeNull();
    expect(f.juros).toBe(12);
    expect(f.renda).toBeCloseTo(19021.55, 2);
  });
});

describe('avaliarTipologia', () => {
  it('HIS-1 + Faixa 2 dentro: ok, com folga do teto', () => {
    const r = avaliarTipologia(tip(239_000, 36), P, MUN, MCMV);
    expect(r).toMatchObject({
      precoM2: 6638.89,
      municipal: { categoria: 'HIS1', teto: 276102.2, folga: 37102.2, folgaPercentual: 13.4, rendaMax: 4863, rendaDentro: true },
      mcmv: { faixaPeloPreco: 'F1', faixaPelaRenda: 'F2', tetoFaixaPelaRenda: 275000, enquadra: true },
      financiamento: { valorFinanciado: 191200, entrada: 47800, jurosAnual: 7, rendaNecessaria: 3975.98 },
      situacao: 'ok',
      avisos: [],
    });
  });

  it('fronteira exata: R$ 276.102,20 = HIS-1; +0,01 = HIS-2', () => {
    expect(avaliarTipologia(tip(276_102.2), P, MUN, MCMV).municipal.categoria).toBe('HIS1');
    expect(avaliarTipologia(tip(276_102.21), P, MUN, MCMV).municipal.categoria).toBe('HIS2');
    expect(avaliarTipologia(tip(537_672.71), P, MUN, MCMV).municipal.categoria).toBe('HMP');
    expect(avaliarTipologia(tip(537_672.72), P, MUN, MCMV).municipal.categoria).toBe('MERCADO');
  });

  it('preco no teto HIS-1, mas sem entrada a renda passa do limite HIS-1 -> atencao com aviso', () => {
    const r = avaliarTipologia(tip(276_102.2), { ...P, entradaPercentual: 0 }, MUN, MCMV);
    expect(r.financiamento.rendaNecessaria).toBeCloseTo(6449.99, 2);
    expect(r.municipal.rendaDentro).toBe(false);
    expect(r.mcmv).toMatchObject({ faixaPelaRenda: 'F3', enquadra: true });
    expect(r.situacao).toBe('atencao');
    expect(r.avisos[0]).toContain('passa do limite de renda HIS-1 (R$ 4.863)');
  });

  it('renda pela parcela abaixo do piso da unica faixa que cobre -> enquadra pelo piso, com aviso', () => {
    const r = avaliarTipologia(tip(450_000, 65), { ...P, jurosAnual: 5 }, MUN, MCMV);
    expect(r.financiamento.rendaNecessaria).toBe(9600.01);
    expect(r.mcmv).toMatchObject({ faixaPeloPreco: 'F4', faixaPelaRenda: 'F4', enquadra: true, rendaPeloPiso: true });
    expect(r.municipal).toMatchObject({ categoria: 'HMP', rendaDentro: true });
    expect(r.situacao).toBe('ok');
    expect(r.avisos.join(' ')).toContain('só cabe a partir da Faixa 4, que começa em R$ 9.601');
  });

  it('R$ 545 mil com 50% de entrada: HMP + Faixa 4 (antes saia "fora")', () => {
    const r = avaliarTipologia(tip(545_000, 70), { ...P, entradaPercentual: 50 }, MUN, MCMV);
    expect(r.mcmv.enquadra).toBe(true);
    expect(r.mcmv.faixaPelaRenda).toBe('F4');
    expect(r.situacao).toBe('atencao'); // acima de HMP (537.672,71)
  });

  it('renda acima da F4 com preco coberto -> aviso de SBPE e fora (se acima de HMP)', () => {
    const r = avaliarTipologia(tip(590_000, 80), { ...P, entradaPercentual: 0 }, MUN, MCMV);
    expect(r.mcmv).toMatchObject({ faixaPeloPreco: 'F4', faixaPelaRenda: null, enquadra: false });
    expect(r.situacao).toBe('fora');
    expect(r.avisos.join(' ')).toContain('passa do limite de renda da Faixa 4');
  });

  it('Faixa 4 acima do teto HMP: cabe no MCMV, mas e mercado no municipal -> atencao', () => {
    const r = avaliarTipologia(tip(550_000, 70), P, MUN, MCMV);
    expect(r.municipal).toMatchObject({ categoria: 'MERCADO', teto: null, folga: null, rendaDentro: null });
    expect(r.mcmv).toMatchObject({ faixaPelaRenda: 'F4', enquadra: true });
    expect(r.financiamento.rendaNecessaria).toBeCloseTo(12637.93, 2);
    expect(r.situacao).toBe('atencao');
    expect(r.avisos[0]).toContain('passa do teto HMP');
  });

  it('acima de HMP e fora do MCMV -> fora, juros SBPE', () => {
    const r = avaliarTipologia(tip(700_000, 90), P, MUN, MCMV);
    expect(r.financiamento.jurosAnual).toBe(12);
    expect(r.mcmv).toMatchObject({ faixaPeloPreco: null, faixaPelaRenda: null, rotuloFaixaPelaRenda: 'Fora do MCMV', enquadra: false });
    expect(r.situacao).toBe('fora');
    expect(r.avisos).toHaveLength(2);
  });

  it('premissas mudam a renda: comprometimento 25% exige renda maior', () => {
    const p: Premissas = { ...P, comprometimentoPercentual: 25 };
    expect(avaliarTipologia(tip(239_000), p, MUN, MCMV).financiamento.rendaNecessaria).toBeGreaterThan(4700);
  });
});
