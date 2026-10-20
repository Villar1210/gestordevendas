import { calcularAnaliseEndereco, ParametrosCalculo, TransacaoParaAnalise } from './analise-endereco';
import { categoriaFinanciamento, ehUnidadeNaPlanta, usosDoTipo, usosPrecoM2 } from './itbi-classificacao';
import { dataUtc } from './data-utc';

const CENTRO = { lat: -23.5934, lng: -46.5627 }; // Vila Ema (aprox.)
// deslocamento em metros para o norte (1 grau lat ~ 111.195 m)
const norte = (m: number) => ({ latitude: CENTRO.lat + m / 111_195, longitude: CENTRO.lng });

function t(p: Partial<TransacaoParaAnalise> & { m?: number }): TransacaoParaAnalise {
  const { m = 100, ...resto } = p;
  return {
    dataTransacao: dataUtc(2026, 5, 15),
    logradouro: 'R TESTE',
    numero: '1',
    bairro: 'VILA EMA',
    areaConstruida: 50,
    valorTransacao: 400_000, // 8.000/m2
    usoIptu: 20,
    naturezaCodigo: 1,
    tipoFinanciamentoCodigo: null,
    tipoFinanciamento: null,
    ...norte(m),
    ...resto,
  };
}

const P: ParametrosCalculo = {
  centro: CENTRO,
  raioMetros: 1000,
  de: dataUtc(2026, 3, 1),
  ate: dataUtc(2026, 8, 7),
  tipo: 'residencial',
  somenteCompraVenda: true,
  areaMin: null,
  areaMax: null,
};

describe('analise-endereco - calculo', () => {
  it('sem transacoes: resumo nulo, porMes com todos os meses zerados', () => {
    const r = calcularAnaliseEndereco([], P);
    expect(r.resumo).toEqual({ transacoes: 0, precoM2Mediano: null, precoM2P25: null, precoM2P75: null, valorMediano: null, areaMediana: null });
    expect(r.porMes.map((m) => m.mes)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(r.porMes.every((m) => m.transacoes === 0 && m.precoM2Mediano === null)).toBe(true);
    expect(r.planta).toEqual({ transacoes: 0, valorMediano: null, comMcmv: 0 });
    expect(r.amostra).toEqual([]);
  });

  it('corta pelo raio (haversine), inclusive fora do periodo e natureza', () => {
    const r = calcularAnaliseEndereco(
      [
        t({ m: 900 }),
        t({ m: 1100 }), // fora do raio
        t({ dataTransacao: dataUtc(2026, 2, 31) }), // antes do periodo
        t({ naturezaCodigo: 20 }), // integralizacao de capital
      ],
      P,
    );
    expect(r.resumo.transacoes).toBe(1);
    expect(r.noRaio).toBe(1);
    const semFiltroNatureza = calcularAnaliseEndereco([t({ naturezaCodigo: 20 })], { ...P, somenteCompraVenda: false });
    expect(semFiltroNatureza.resumo.transacoes).toBe(1);
  });

  it('preco/m2: mediana, p25, p75; outliers (<500 e >60.000) fora do calculo mas contando', () => {
    const linhas = [
      t({ valorTransacao: 300_000 }), // 6.000
      t({ valorTransacao: 400_000 }), // 8.000
      t({ valorTransacao: 500_000 }), // 10.000
      t({ valorTransacao: 600_000 }), // 12.000
      t({ valorTransacao: 10_000 }), // 200/m2 outlier
      t({ valorTransacao: 5_000_000 }), // 100.000/m2 outlier
      t({ areaConstruida: null, valorTransacao: 1 }), // sem area: sem preco/m2
    ];
    const r = calcularAnaliseEndereco(linhas, P);
    expect(r.resumo.transacoes).toBe(7);
    expect(r.resumo.precoM2Mediano).toBe(9000);
    expect(r.resumo.precoM2P25).toBe(7500);
    expect(r.resumo.precoM2P75).toBe(10500);
    expect(r.resumo.valorMediano).toBe(400_000);
    expect(r.resumo.areaMediana).toBe(50);
  });

  it('R$/m2 so com usos residenciais; garagem (24) e loja (40) contam em "todos" mas sem R$/m2', () => {
    const linhas = [t({ usoIptu: 20 }), t({ usoIptu: 24, valorTransacao: 50_000, areaConstruida: 10 }), t({ usoIptu: 40, valorTransacao: 900_000 })];
    const residencial = calcularAnaliseEndereco(linhas, P);
    expect(residencial.resumo.transacoes).toBe(1);
    const todos = calcularAnaliseEndereco(linhas, { ...P, tipo: 'todos' });
    expect(todos.resumo.transacoes).toBe(3);
    expect(todos.resumo.precoM2Mediano).toBe(8000);
  });

  it('tipo casa x apartamento', () => {
    const linhas = [t({ usoIptu: 10, valorTransacao: 250_000 }), t({ usoIptu: 20 }), t({ usoIptu: 25 })];
    expect(calcularAnaliseEndereco(linhas, { ...P, tipo: 'casa' }).resumo).toMatchObject({ transacoes: 1, precoM2Mediano: 5000 });
    expect(calcularAnaliseEndereco(linhas, { ...P, tipo: 'apartamento' }).resumo.transacoes).toBe(2);
  });

  it('na planta (uso 0, area 0) fica separado, com MCMV; nunca no R$/m2', () => {
    const linhas = [
      t({}),
      t({ usoIptu: 0, areaConstruida: 0, valorTransacao: 250_000, tipoFinanciamentoCodigo: 2, tipoFinanciamento: 'Minha Casa Minha Vida' }),
      t({ usoIptu: 0, areaConstruida: null, valorTransacao: 270_000, tipoFinanciamentoCodigo: 1 }),
      t({ usoIptu: 0, areaConstruida: 0, valorTransacao: 290_000 }),
    ];
    const r = calcularAnaliseEndereco(linhas, { ...P, tipo: 'todos' });
    expect(r.resumo.transacoes).toBe(1);
    expect(r.resumo.precoM2Mediano).toBe(8000);
    expect(r.planta).toEqual({ transacoes: 3, valorMediano: 270_000, comMcmv: 1 });
    expect(r.financiamento).toEqual({ mcmv: 1, sfh: 1, outros: 0, semFinanciamento: 2 });
    expect(r.amostra).toHaveLength(1);
  });

  it('faixa de area (areaMin/areaMax) na contagem principal', () => {
    const linhas = [t({ areaConstruida: 40 }), t({ areaConstruida: 60 }), t({ areaConstruida: 90 }), t({ areaConstruida: null })];
    expect(calcularAnaliseEndereco(linhas, { ...P, areaMin: 50, areaMax: 80 }).resumo.transacoes).toBe(1);
    expect(calcularAnaliseEndereco(linhas, { ...P, areaMin: 50 }).resumo.transacoes).toBe(2);
  });

  it('porMes: contagem e mediana por mes', () => {
    const linhas = [
      t({ dataTransacao: dataUtc(2026, 3, 1) }),
      t({ dataTransacao: dataUtc(2026, 3, 30), valorTransacao: 500_000 }),
      t({ dataTransacao: dataUtc(2026, 8, 7) }),
    ];
    const r = calcularAnaliseEndereco(linhas, P);
    expect(r.porMes[0]).toEqual({ mes: '2026-04', transacoes: 2, precoM2Mediano: 9000 });
    expect(r.porMes[5]).toEqual({ mes: '2026-09', transacoes: 1, precoM2Mediano: 8000 });
  });

  it('amostra: mais proximas primeiro, no maximo 200, com distancia e preco/m2', () => {
    const linhas = Array.from({ length: 250 }, (_, i) => t({ m: 990 - i * 3, numero: String(i) }));
    const r = calcularAnaliseEndereco(linhas, P);
    expect(r.amostra).toHaveLength(200);
    expect(r.amostra[0].numero).toBe('249');
    for (let i = 1; i < r.amostra.length; i++) {
      expect(r.amostra[i].distanciaMetros).toBeGreaterThanOrEqual(r.amostra[i - 1].distanciaMetros);
    }
    expect(r.amostra[0]).toMatchObject({ data: '2026-06-15', precoM2: 8000, valor: 400_000, areaConstruida: 50 });
  });
});

describe('itbi-classificacao', () => {
  it('usos por tipo', () => {
    expect(usosPrecoM2('residencial')).toEqual([10, 12, 14, 20, 21, 22, 25]);
    expect(usosPrecoM2('todos')).toEqual([10, 12, 14, 20, 21, 22, 25]);
    expect(usosDoTipo('todos')).toBeNull();
    expect(usosDoTipo('casa')).toEqual([10, 12, 14]);
    expect(usosDoTipo('apartamento')).toEqual([20, 21, 22, 25]);
  });

  it('unidade na planta', () => {
    expect(ehUnidadeNaPlanta(0, 0)).toBe(true);
    expect(ehUnidadeNaPlanta(0, null)).toBe(true);
    expect(ehUnidadeNaPlanta(0, 30)).toBe(false);
    expect(ehUnidadeNaPlanta(20, 0)).toBe(false);
  });

  it('categoria de financiamento por codigo, com fallback pelo texto', () => {
    expect(categoriaFinanciamento(2, 'Minha Casa Minha Vida')).toBe('mcmv');
    expect(categoriaFinanciamento(1, null)).toBe('sfh');
    expect(categoriaFinanciamento(3, 'Consórcio')).toBe('outros');
    expect(categoriaFinanciamento(99, null)).toBe('outros');
    expect(categoriaFinanciamento(null, null)).toBe('semFinanciamento');
    expect(categoriaFinanciamento(null, 'Minha Casa Minha Vida')).toBe('mcmv');
    expect(categoriaFinanciamento(null, 'Sistema Financeiro de Habitação')).toBe('sfh');
  });
});
