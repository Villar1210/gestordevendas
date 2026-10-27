import { VERSOES_MCMV } from './parametros-habitacionais';
import { VERSOES_CUB } from './referencia-cub';
import {
  calcularResultadoFinanceiro,
  PADROES_FINANCEIROS,
  PremissasFinanceiras,
  TipologiaFinanceira,
  validarEntradaFinanceira,
} from './viabilidade-financeira';

const CUB = VERSOES_CUB[0];
const MCMV = VERSOES_MCMV[0];

function premissas(over: {
  terreno?: Partial<PremissasFinanceiras['terreno']>;
  obra?: Partial<PremissasFinanceiras['obra']>;
  comercial?: Partial<PremissasFinanceiras['comercial']>;
  margemAlvoPercentual?: number;
} = {}): PremissasFinanceiras {
  return {
    terreno: { ...PADROES_FINANCEIROS.terreno, ...over.terreno },
    obra: { ...PADROES_FINANCEIROS.obra, custoM2: 2600, fatorAreaConstruida: 1.5, ...over.obra },
    comercial: { ...PADROES_FINANCEIROS.comercial, impostoPercentual: 4, ...over.comercial },
    margemAlvoPercentual: over.margemAlvoPercentual ?? PADROES_FINANCEIROS.margemAlvoPercentual,
  };
}

const T100: TipologiaFinanceira[] = [{ descricao: '2 dorm', areaPrivativa: 50, preco: 350_000, quantidade: 100 }];

describe('calcularResultadoFinanceiro', () => {
  it('exemplo do contrato: VGV 35 mi, terreno maximo ~R$ 3,0 mi para 15%', () => {
    const r = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV);
    expect(r.vgv).toEqual({ total: 35_000_000, permuta: 0, vendavel: 35_000_000 });
    expect(r.deducoes).toEqual({ imposto: 1_400_000, comissao: 1_750_000, marketing: 1_050_000, total: 4_200_000 });
    expect(r.receitaLiquida).toBe(30_800_000);
    expect(r.areas).toMatchObject({ unidades: 100, privativaTotal: 5000, construida: 7500, fatorEfetivo: 1.5, construidaInformada: false });
    expect(r.custos.obra).toBe(19_500_000);
    expect(r.custos.indiretos).toBe(1_950_000);
    expect(r.custos.contingencia).toBe(975_000);
    expect(r.custos.terreno.total).toBe(0);
    expect(r.resultado.lucro).toBe(8_375_000);
    // calculo independente: (30,8 - 22,425 - 0,15 x 35) / 1,04
    expect(r.resultado.valorMaximoTerreno).toBeCloseTo(3_125_000 / 1.04, 2);
    expect(r.resultado.situacao).toBe('viavel');
    expect(r.resultado.custoObraM2Privativo).toBe(3900);
  });

  it('comprando pelo valor maximo, a margem fica exatamente na margem-alvo', () => {
    const max = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV).resultado.valorMaximoTerreno!;
    const r = calcularResultadoFinanceiro(T100, premissas({ terreno: { valorCompra: max } }), CUB, MCMV);
    expect(r.resultado.margemVgvPercentual).toBe(15);
    expect(r.resultado.situacao).toBe('viavel');
    expect(r.custos.terreno.itbi).toBeCloseTo(max * 0.03, 1);
    expect(r.custos.terreno.escrituraRegistro).toBeCloseTo(max * 0.01, 1);
    expect(r.avisos.join(' ')).not.toMatch(/passa do máximo/);
  });

  it('1 real acima do maximo: apertado e aviso de terreno acima do maximo', () => {
    const max = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV).resultado.valorMaximoTerreno!;
    const r = calcularResultadoFinanceiro(T100, premissas({ terreno: { valorCompra: max + 100_000 } }), CUB, MCMV);
    expect(r.resultado.situacao).toBe('apertado');
    expect(r.avisos.join(' ')).toMatch(/passa do máximo para 15% de margem/);
    expect(r.avisos.join(' ')).toMatch(/abaixo da margem desejada/);
  });

  it('prejuizo: inviavel', () => {
    const r = calcularResultadoFinanceiro(T100, premissas({ terreno: { valorCompra: 20_000_000 } }), CUB, MCMV);
    expect(r.resultado.lucro).toBeLessThan(0);
    expect(r.resultado.situacao).toBe('inviavel');
    expect(r.avisos.join(' ')).toMatch(/Prejuízo estimado/);
  });

  it('nem de graca chega na margem: valor maximo null', () => {
    const r = calcularResultadoFinanceiro(T100, premissas({ obra: { custoM2: 4000 } }), CUB, MCMV);
    expect(r.resultado.valorMaximoTerreno).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/Mesmo com o terreno de graça/);
  });

  it('permuta: tira o % do VGV vendavel, deducoes so sobre o vendavel, peso do terreno soma a permuta', () => {
    const r = calcularResultadoFinanceiro(
      T100,
      premissas({ terreno: { permutaPercentual: 10, valorCompra: 1_000_000 } }),
      CUB,
      MCMV,
    );
    expect(r.vgv).toEqual({ total: 35_000_000, permuta: 3_500_000, vendavel: 31_500_000 });
    expect(r.deducoes.imposto).toBe(1_260_000);
    // (1.040.000 + 3.500.000) / 35.000.000
    expect(r.resultado.pesoTerrenoPercentual).toBe(13);
    expect(r.avisos.join(' ')).toMatch(/permuta também tem tributação/);
  });

  it('area construida informada prevalece sobre o fator', () => {
    const r = calcularResultadoFinanceiro(T100, premissas({ obra: { areaConstruida: 8000 } }), CUB, MCMV);
    expect(r.areas).toMatchObject({ construida: 8000, fatorEfetivo: 1.6, construidaInformada: true });
    expect(r.custos.obra).toBe(20_800_000);
  });

  it('varias tipologias somam VGV e area', () => {
    const r = calcularResultadoFinanceiro(
      [
        { descricao: 'A', areaPrivativa: 40, preco: 260_000, quantidade: 60 },
        { descricao: 'B', areaPrivativa: 55, preco: 380_000, quantidade: 40 },
      ],
      premissas(),
      CUB,
      MCMV,
    );
    expect(r.vgv.total).toBe(60 * 260_000 + 40 * 380_000);
    expect(r.areas.privativaTotal).toBe(60 * 40 + 40 * 55);
    expect(r.areas.unidades).toBe(100);
  });

  it('custo abaixo do CUB gera aviso; razao custo/CUB', () => {
    const r = calcularResultadoFinanceiro(T100, premissas({ obra: { custoM2: 2000 } }), CUB, MCMV);
    expect(r.avisos.join(' ')).toMatch(/abaixo do CUB-SP/);
    expect(r.referenciaCub.razaoCustoCub).toBe(0.89);
    const ok = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV);
    expect(ok.avisos.join(' ')).not.toMatch(/abaixo do CUB-SP/);
    expect(ok.referenciaCub.razaoCustoCub).toBe(1.16);
  });

  it('RET 1% com tipologia fora do MCMV pelo preco gera aviso', () => {
    const tips = [
      { descricao: 'Studio', areaPrivativa: 30, preco: 250_000, quantidade: 10 },
      { descricao: 'Cobertura', areaPrivativa: 120, preco: 900_000, quantidade: 2 },
    ];
    const r = calcularResultadoFinanceiro(tips, premissas({ comercial: { impostoRegime: 'ret1', impostoPercentual: 1 } }), CUB, MCMV);
    expect(r.avisos.join(' ')).toMatch(/RET 1% escolhido, mas a tipologia Cobertura/);
    const dentro = calcularResultadoFinanceiro([tips[0]], premissas({ comercial: { impostoRegime: 'ret1', impostoPercentual: 1 } }), CUB, MCMV);
    expect(dentro.avisos.join(' ')).not.toMatch(/RET 1% escolhido/);
    expect(dentro.avisos.join(' ')).toMatch(/RET-MCMV/);
  });

  it('revisao M1: margem 14,96% (arredonda para 15,0) e apertado, coerente com terreno acima do maximo', () => {
    const t = [{ descricao: 'A', areaPrivativa: 50, preco: 250_000, quantidade: 80 }];
    const base = premissas({ obra: { custoM2: 2800, areaConstruida: 4000 } });
    const max = calcularResultadoFinanceiro(t, base, CUB, MCMV).resultado.valorMaximoTerreno!;
    const r = calcularResultadoFinanceiro(t, { ...base, terreno: { ...base.terreno, valorCompra: max + 8000 } }, CUB, MCMV);
    expect(r.resultado.margemVgvPercentual).toBe(15);
    expect(r.resultado.situacao).toBe('apertado');
    expect(r.avisos.join(' ')).toMatch(/passa do máximo/);
  });

  it('valor maximo 0 (terreno de graca fica exatamente no alvo) nao vira null', () => {
    const base = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV);
    const alvo = (base.resultado.lucro / base.vgv.vendavel) * 100;
    const r = calcularResultadoFinanceiro(T100, premissas({ margemAlvoPercentual: alvo }), CUB, MCMV);
    expect(r.resultado.valorMaximoTerreno).toBeCloseTo(0, 2);
    expect(r.resultado.situacao).toBe('viavel');
  });

  it('com permuta os avisos falam em VGV vendavel', () => {
    const r = calcularResultadoFinanceiro(T100, premissas({ terreno: { permutaPercentual: 10 }, obra: { custoM2: 3200 } }), CUB, MCMV);
    expect(r.avisos.join(' ')).toMatch(/do VGV vendável/);
  });

  it('fronteira apertado/inviavel: lucro zero e apertado', () => {
    // custo total = receita liquida -> lucro 0
    const base = calcularResultadoFinanceiro(T100, premissas(), CUB, MCMV);
    const compra = base.resultado.lucro / 1.04;
    const r = calcularResultadoFinanceiro(T100, premissas({ terreno: { valorCompra: compra } }), CUB, MCMV);
    expect(r.resultado.lucro).toBeCloseTo(0, 1);
    expect(r.resultado.situacao).toBe('apertado');
  });
});

describe('validarEntradaFinanceira', () => {
  it('area construida menor que a privativa total e recusada', () => {
    expect(validarEntradaFinanceira(T100, premissas({ obra: { areaConstruida: 4000 } }))).toMatch(/não pode ser menor/);
    expect(validarEntradaFinanceira(T100, premissas({ obra: { areaConstruida: 5000 } }))).toBeNull();
    expect(validarEntradaFinanceira(T100, premissas())).toBeNull();
    expect(validarEntradaFinanceira([], premissas())).toMatch(/ao menos uma/);
  });
});
