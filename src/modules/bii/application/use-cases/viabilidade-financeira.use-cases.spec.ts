import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CalcularViabilidadeFinanceiraUseCase,
  GetParametrosFinanceirosUseCase,
  MENSAGEM_CUSTO_OBRA_OBRIGATORIO,
  MENSAGEM_IMPOSTO_OUTRO,
  resolverPremissasFinanceiras,
} from './viabilidade-financeira.use-cases';

const AGORA = new Date('2026-10-27T12:00:00Z');
const T = [{ descricao: ' 2\u0007 dorm ', areaPrivativa: 50, preco: 350_000, quantidade: 100 }];

describe('resolverPremissasFinanceiras', () => {
  it('aplica os padroes do contrato', () => {
    expect(resolverPremissasFinanceiras({ obra: { custoM2: 2600 } })).toEqual({
      terreno: { valorCompra: 0, itbiPercentual: 3, escrituraRegistroPercentual: 1, permutaPercentual: 0 },
      obra: { custoM2: 2600, areaConstruida: null, fatorAreaConstruida: 1.6, indiretosPercentual: 10, contingenciaPercentual: 5 },
      comercial: { impostoRegime: 'ret4', impostoPercentual: 4, comissaoPercentual: 5, marketingPercentual: 3 },
      margemAlvoPercentual: 15,
    });
  });
  it('custo de obra obrigatorio', () => {
    expect(() => resolverPremissasFinanceiras(undefined)).toThrow(MENSAGEM_CUSTO_OBRA_OBRIGATORIO);
    expect(() => resolverPremissasFinanceiras({ obra: {} })).toThrow(BadRequestException);
  });
  it('regime: ret1 = 1% (percentual digitado ignorado); outro exige percentual', () => {
    expect(resolverPremissasFinanceiras({ obra: { custoM2: 2600 }, comercial: { impostoRegime: 'ret1', impostoPercentual: 9 } }).comercial.impostoPercentual).toBe(1);
    expect(resolverPremissasFinanceiras({ obra: { custoM2: 2600 }, comercial: { impostoRegime: 'outro', impostoPercentual: 6.73 } }).comercial.impostoPercentual).toBe(6.73);
    expect(() => resolverPremissasFinanceiras({ obra: { custoM2: 2600 }, comercial: { impostoRegime: 'outro' } })).toThrow(MENSAGEM_IMPOSTO_OUTRO);
  });
});

describe('CalcularViabilidadeFinanceiraUseCase', () => {
  const uc = new CalcularViabilidadeFinanceiraUseCase();
  it('so Administrador', () => {
    expect(() => uc.execute({ requesterRole: 'Corretor', tipologias: T, premissas: { obra: { custoM2: 2600 } } })).toThrow(ForbiddenException);
  });
  it('calcula, limpa a descricao e usa o CUB vigente', () => {
    const r = uc.execute({ requesterRole: 'Administrador', tipologias: T, premissas: { obra: { custoM2: 2600, fatorAreaConstruida: 1.5 } }, agora: AGORA });
    expect(r.tipologias[0].descricao).toBe('2 dorm');
    expect(r.resultado.valorMaximoTerreno).toBeCloseTo(3_004_807.69, 1);
    expect(r.referenciaCub).toMatchObject({ mesReferencia: '2026-08', valorM2: 2235.58 });
    expect(r.observacao).toMatch(/Estimativa/);
  });
  it('area construida menor que a privativa -> 400', () => {
    expect(() => uc.execute({ requesterRole: 'Administrador', tipologias: T, premissas: { obra: { custoM2: 2600, areaConstruida: 100 } } })).toThrow(/não pode ser menor/);
  });
});

describe('GetParametrosFinanceirosUseCase', () => {
  it('devolve padroes, regimes e CUB', () => {
    const r = new GetParametrosFinanceirosUseCase().execute({ requesterRole: 'Administrador', agora: AGORA });
    expect(r.padroes.margemAlvoPercentual).toBe(15);
    expect(r.regimesImposto.map((x) => x.valor)).toEqual(['ret4', 'ret1', 'outro']);
    expect(r.cub.valorM2).toBe(2235.58);
  });
});
