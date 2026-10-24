import {
  centroideGeometria,
  combinarCentroides,
  decomporSql,
  interpretarLote,
  interpretarQuadra,
  precisoesPiores,
} from './geosampa';

// quadrado de ~0,001 grau na Vila Ema
const Q = (x: number, y: number, d = 0.001): [number, number][] => [
  [x, y],
  [x + d, y],
  [x + d, y + d],
  [x, y + d],
  [x, y],
];

describe('centroideGeometria', () => {
  it('quadrado: centro exato', () => {
    const c = centroideGeometria({ type: 'Polygon', coordinates: [Q(-46.55, -23.59)] })!;
    expect(c.lng).toBeCloseTo(-46.5495, 6);
    expect(c.lat).toBeCloseTo(-23.5895, 6);
  });

  it('sentido horario ou anti-horario da o mesmo centro', () => {
    const a = centroideGeometria({ type: 'Polygon', coordinates: [Q(-46.55, -23.59)] })!;
    const b = centroideGeometria({ type: 'Polygon', coordinates: [Q(-46.55, -23.59).reverse()] })!;
    expect(b.lat).toBeCloseTo(a.lat, 9);
    expect(b.lng).toBeCloseTo(a.lng, 9);
  });

  it('buraco desloca o centro para o lado cheio', () => {
    const externo = Q(-46.55, -23.59, 0.002);
    const buraco = Q(-46.549, -23.59, 0.001); // metade direita de baixo
    const c = centroideGeometria({ type: 'Polygon', coordinates: [externo, buraco] })!;
    expect(c.lng).toBeLessThan(-46.549); // centro foi para a esquerda
  });

  it('multipoligono pondera pela area', () => {
    const c = centroideGeometria({
      type: 'MultiPolygon',
      coordinates: [[Q(-46.55, -23.59, 0.002)], [Q(-46.54, -23.59, 0.001)]],
    })!;
    // o grande (4x a area) puxa o centro para perto dele
    expect(c.lng).toBeLessThan(-46.546);
  });

  it('recusa geometria fora da capital, ponto, vazia ou invalida', () => {
    expect(centroideGeometria({ type: 'Polygon', coordinates: [Q(-45.88, -23.2)] })).toBeNull(); // Sao Jose dos Campos
    expect(centroideGeometria({ type: 'Point', coordinates: [-46.5, -23.5] })).toBeNull();
    expect(centroideGeometria({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(centroideGeometria(null)).toBeNull();
    expect(centroideGeometria({ type: 'Polygon', coordinates: [[['a', 'b'], [1], null]] })).toBeNull();
  });
});

describe('combinarCentroides', () => {
  it('media ponderada pela area; peso zero vira media simples', () => {
    const c = combinarCentroides([
      { lat: -23.5, lng: -46.5, peso: 3 },
      { lat: -23.6, lng: -46.6, peso: 1 },
    ])!;
    expect(c.lat).toBeCloseTo(-23.525, 9);
    const s = combinarCentroides([
      { lat: -23.5, lng: -46.5, peso: 0 },
      { lat: -23.6, lng: -46.6, peso: 0 },
    ])!;
    expect(s.lat).toBeCloseTo(-23.55, 9);
    expect(combinarCentroides([])).toBeNull();
  });
});

describe('interpretarQuadra / interpretarLote', () => {
  const geom = { type: 'Polygon', coordinates: [Q(-46.55, -23.59)] };

  it('quadra fiscal valida; outros tipos ficam de fora', () => {
    expect(
      interpretarQuadra({ properties: { cd_setor_fiscal: '160', cd_quadra_fiscal: '177', cd_tipo_quadra: 'F' }, geometry: geom }),
    ).toMatchObject({ setor: '160', quadra: '177' });
    expect(
      interpretarQuadra({ properties: { cd_setor_fiscal: '160', cd_quadra_fiscal: '177', cd_tipo_quadra: 'QP' }, geometry: geom }),
    ).toBeNull();
    expect(interpretarQuadra({ properties: { cd_setor_fiscal: 'x', cd_quadra_fiscal: '177', cd_tipo_quadra: 'F' }, geometry: geom })).toBeNull();
  });

  it('lote: completa zeros, condominio padrao 00 e cancelado = inativo', () => {
    const l = interpretarLote({
      properties: { cd_setor_fiscal: 148, cd_quadra_fiscal: 63, cd_lote: 24, cd_condominio: null, cd_tipo_lote: 'F', tx_situ_lote: 'CANCELADO' },
      geometry: geom,
    })!;
    expect(l).toMatchObject({ setor: '148', quadra: '063', lote: '0024', condominio: '00', ativo: false });
    expect(interpretarLote({ properties: { cd_setor_fiscal: '148', cd_quadra_fiscal: '063', cd_lote: '0024', cd_tipo_lote: 'V' }, geometry: geom })).toBeNull();
  });
});

describe('decomporSql', () => {
  it('11 digitos, com ou sem pontuacao', () => {
    expect(decomporSql('14806300241')).toEqual({ setor: '148', quadra: '063', lote: '0024' });
    expect(decomporSql('148.063.0024-1')).toEqual({ setor: '148', quadra: '063', lote: '0024' });
  });

  it('formato estranho = null', () => {
    expect(decomporSql('1480630024')).toBeNull();
    expect(decomporSql('000.000.0000-0')).toBeNull();
    expect(decomporSql('abc')).toBeNull();
    expect(decomporSql(null)).toBeNull();
  });
});

describe('precisoesPiores', () => {
  it('lote substitui tudo; quadra nao substitui numero nem lote', () => {
    expect(precisoesPiores('lote').sort()).toEqual(['bairro', 'cep', 'quadra', 'rooftop', 'rua']);
    expect(precisoesPiores('quadra').sort()).toEqual(['bairro', 'cep', 'rua']);
  });
});
