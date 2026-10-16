import {
  derivarLazerDasLegendas,
  derivarTipologiasDasLegendas,
  fichaPrecisaComplemento,
  selecionarPaginasParaComplementoFicha,
} from './book-empreendimento';

const p = (categoria: string, legenda: string | null) => ({ categoria, legenda });

describe('derivarLazerDasLegendas', () => {
  it('usa so paginas area_comum, tira termos genericos e deduplica (sem acento/caixa)', () => {
    expect(
      derivarLazerDasLegendas([
        p('area_comum', 'Piscina área comum'),
        p('area_comum', 'PISCINA (Área Comum)'),
        p('area_comum', 'Quadra esporte área comum'),
        p('area_comum', 'Adega wine bar'),
        p('area_comum', 'Lounge pet care'),
        p('area_comum', 'Áreas comuns'),
        p('area_comum', null),
        p('fachada', 'Fachada'),
        p('planta', 'Planta 2 dormitórios 60,30m2'),
      ]),
    ).toEqual(['Piscina', 'Quadra esporte', 'Adega wine bar', 'Lounge pet care']);
  });

  it('no maximo 30 itens', () => {
    const paginas = Array.from({ length: 40 }, (_, i) => p('area_comum', `Espaço ${i + 1}`));
    expect(derivarLazerDasLegendas(paginas)).toHaveLength(30);
  });
});

describe('derivarTipologiasDasLegendas', () => {
  it('le metragem (virgula ou ponto, m2 ou m²) e dormitorios; ignora implantacao/terreno', () => {
    expect(
      derivarTipologiasDasLegendas([
        p('planta', 'Planta 2 dormitórios 60,30m2'),
        p('planta', 'Planta terreo garden 50,62m2'),
        p('planta', 'Planta 3 dorms 72.5 m²'),
        p('planta', 'Implantação terreno áreas comuns'),
        p('planta', 'Implantação 5.000 m2'),
        p('planta', 'Planta tipo'),
        p('planta', 'Planta 1 quarto'),
        p('planta', 'Planta 2 dormitórios 60,30m2'),
        p('area_comum', 'Salão 120 m2'),
      ]),
    ).toEqual([
      { nome: 'Planta 2 dormitórios 60,30m2', areaPrivativa: 60.3, dormitorios: 2 },
      { nome: 'Planta terreo garden 50,62m2', areaPrivativa: 50.62, dormitorios: null },
      { nome: 'Planta 3 dorms 72.5 m²', areaPrivativa: 72.5, dormitorios: 3 },
      { nome: 'Planta 1 quarto', areaPrivativa: null, dormitorios: 1 },
    ]);
  });
});

describe('complemento da ficha', () => {
  const ficha = { areaTerreno: 1, totalUnidades: null, numeroTorres: null, tipologias: [{}], itensLazer: ['x'] };
  it('so precisa quando falta lazer, tipologias ou TODOS os numeros principais', () => {
    expect(fichaPrecisaComplemento(ficha)).toBe(false);
    expect(fichaPrecisaComplemento({ ...ficha, itensLazer: [] })).toBe(true);
    expect(fichaPrecisaComplemento({ ...ficha, tipologias: [] })).toBe(true);
    expect(fichaPrecisaComplemento({ ...ficha, areaTerreno: null })).toBe(true);
  });

  it('paginas: ficha_tecnica, planta, area_comum (nessa ordem), max 10', () => {
    const paginas = [
      { numero: 1, categoria: 'fachada' },
      { numero: 2, categoria: 'area_comum' },
      { numero: 3, categoria: 'planta' },
      { numero: 4, categoria: 'localizacao' },
      { numero: 5, categoria: 'ficha_tecnica' },
    ];
    expect(selecionarPaginasParaComplementoFicha(paginas)).toEqual([5, 3, 2]);
    expect(selecionarPaginasParaComplementoFicha(paginas, 2)).toEqual([5, 3]);
  });
});
