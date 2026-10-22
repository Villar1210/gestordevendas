import { VERSOES_MCMV, VERSOES_MUNICIPAIS } from './parametros-habitacionais';
import { AnaliseParaEstudo, classificarPosicao, contarSituacoes, montarEstudo } from './estudo';
import { avaliarTipologia, PREMISSAS_PADRAO } from './viabilidade';

const MUN = VERSOES_MUNICIPAIS[0];
const MCMV = VERSOES_MCMV[0];
const AGORA = new Date('2026-10-22T12:00:00Z');
const tip = (descricao: string, preco: number, area: number) =>
  avaliarTipologia({ descricao, areaPrivativa: area, preco }, PREMISSAS_PADRAO, MUN, MCMV);

const analise = (p: Partial<AnaliseParaEstudo> = {}): AnaliseParaEstudo => ({
  parametros: { raioMetros: 1000, meses: 12, de: '2025-07-01', ate: '2026-06-30' },
  resumo: { transacoes: 120, precoM2Mediano: 7000, precoM2P25: 6000, precoM2P75: 8200 },
  concorrentes: { resumo: { quantidade: 3, precoM2Mediano: 8000 } },
  ...p,
});

describe('classificarPosicao (faixa inclusiva de +-5%)', () => {
  it.each([
    [8400, 'alinhado', 5],
    [8400.8, 'alinhado', 5], // 5,01% arredonda para 5,0
    [8410, 'acima', 5.1],
    [7600, 'alinhado', -5],
    [7590, 'abaixo', -5.1],
    [8000, 'alinhado', 0],
  ])('R$ %p/m2 contra mediana 8000 -> %p (%p%)', (preco, classe, dif) => {
    expect(classificarPosicao(preco, 8000)).toEqual({ classe, diferencaPercentual: dif });
  });
  it('sem mediana de concorrentes (ou zero) -> null', () => {
    expect(classificarPosicao(8000, null)).toBeNull();
    expect(classificarPosicao(8000, 0)).toBeNull();
  });
});

describe('montarEstudo', () => {
  const v = [tip('2 dorm.', 239_000, 36), tip('3 dorm.', 550_000, 70)];

  it('resumo executivo, posicionamento e destaques', () => {
    const r = montarEstudo({ analise: analise(), analiseCriadaEm: new Date('2026-10-20T12:00:00Z'), viabilidade: v, agora: AGORA });
    expect(r.resumoExecutivo.itbi).toEqual({ transacoes: 120, precoM2Mediano: 7000, precoM2P25: 6000, precoM2P75: 8200, de: '2025-07-01', ate: '2026-06-30' });
    expect(r.resumoExecutivo.concorrentes).toEqual({ quantidade: 3, precoM2Mediano: 8000 });
    expect(r.resumoExecutivo.viabilidade).toEqual({ tipologias: 2, ok: 1, atencao: 1, fora: 0, enquadramMcmv: 2 });
    // 239000/36 = 6638,89 ; 550000/70 = 7857,14 ; media 7248,02 -> -9,4%
    expect(r.resumoExecutivo.tipologias).toEqual({ precoM2Medio: 7248.02, posicaoMedia: { classe: 'abaixo', diferencaPercentual: -9.4 } });
    expect(r.posicionamento[0]).toEqual({
      descricao: '2 dorm.',
      precoM2: 6638.89,
      concorrentes: { classe: 'abaixo', diferencaPercentual: -17 },
      itbi: { precoM2Mediano: 7000, precoM2P25: 6000, precoM2P75: 8200 },
    });
    expect(r.posicionamento[1].concorrentes).toEqual({ classe: 'alinhado', diferencaPercentual: -1.8 });
    expect(r.alertas).toEqual([]);
    expect(r.destaques).toHaveLength(4);
    expect(r.destaques[0]).toContain('120 transação(ões) no raio de 1000 m em 12 meses');
    expect(r.destaques[3]).toContain('9,4% abaixo da mediana da concorrência');
  });

  it('ITBI nunca vira % (so lado a lado)', () => {
    const r = montarEstudo({ analise: analise(), analiseCriadaEm: AGORA, viabilidade: v, agora: AGORA });
    expect(JSON.stringify(r.posicionamento)).not.toMatch(/itbi":\{[^}]*diferenca/);
  });

  it('alertas: amostra pequena, sem concorrentes no raio, analise antiga', () => {
    const r = montarEstudo({
      analise: analise({ resumo: { transacoes: 12, precoM2Mediano: 7000, precoM2P25: null, precoM2P75: null }, concorrentes: { resumo: { quantidade: 0, precoM2Mediano: null } } }),
      analiseCriadaEm: new Date('2026-06-01T12:00:00Z'),
      viabilidade: v,
      agora: AGORA,
    });
    expect(r.alertas.map((a) => a.codigo)).toEqual(['AMOSTRA_PEQUENA', 'SEM_CONCORRENTES', 'ANALISE_ANTIGA']);
    expect(r.alertas[2].mensagem).toContain('143 dias');
    expect(r.posicionamento.every((p) => p.concorrentes === null)).toBe(true);
    expect(r.resumoExecutivo.tipologias.posicaoMedia).toBeNull();
    expect(r.destaques.join(' ')).not.toContain('Concorrência:');
  });

  it('analise anterior a Fatia 3 (sem concorrentes no snapshot)', () => {
    const r = montarEstudo({ analise: analise({ concorrentes: undefined }), analiseCriadaEm: AGORA, viabilidade: v, agora: AGORA });
    expect(r.resumoExecutivo.concorrentes).toBeNull();
    expect(r.alertas.map((a) => a.codigo)).toEqual(['ANALISE_SEM_CONCORRENTES']);
  });

  it('ITBI sem R$/m2 calculavel', () => {
    const r = montarEstudo({
      analise: analise({ resumo: { transacoes: 40, precoM2Mediano: null, precoM2P25: null, precoM2P75: null } }),
      analiseCriadaEm: AGORA,
      viabilidade: v,
      agora: AGORA,
    });
    expect(r.destaques[0]).toContain('sem R$/m² calculável');
  });

  it('contarSituacoes', () => {
    expect(contarSituacoes([{ situacao: 'ok' }, { situacao: 'fora' }, { situacao: 'ok' }])).toEqual({ ok: 2, atencao: 0, fora: 1 });
  });
});
