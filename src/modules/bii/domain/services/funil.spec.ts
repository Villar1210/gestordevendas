import { montarFunil } from './funil';

const etapas = [
  { id: 's1', nome: 'Em Atendimento' },
  { id: 's2', nome: 'Visita' },
  { id: 'sr', nome: 'Repique' },
  { id: 's3', nome: 'Fechamento' },
];

describe('montarFunil', () => {
  it('conta cards distintos por etapa, exclui Repique, conversao para a proxima', () => {
    const funil = montarFunil(etapas, [
      { cardId: 'a', toStageId: 's1' },
      { cardId: 'a', toStageId: 's1' }, // reentrada do mesmo card conta 1
      { cardId: 'b', toStageId: 's1' },
      { cardId: 'c', toStageId: 's1' },
      { cardId: 'd', toStageId: 's1' },
      { cardId: 'a', toStageId: 's2' },
      { cardId: 'b', toStageId: 's2' },
      { cardId: 'c', toStageId: 'sr' },
      { cardId: 'a', toStageId: 's3' },
    ]);
    expect(funil).toEqual([
      { stageId: 's1', nome: 'Em Atendimento', entradas: 4, conversaoProximaPct: 50 },
      { stageId: 's2', nome: 'Visita', entradas: 2, conversaoProximaPct: 50 },
      { stageId: 's3', nome: 'Fechamento', entradas: 1, conversaoProximaPct: null },
    ]);
  });

  it('etapa sem entradas -> conversao null (divisao por zero)', () => {
    const funil = montarFunil(etapas, [{ cardId: 'a', toStageId: 's2' }]);
    expect(funil[0]).toEqual({ stageId: 's1', nome: 'Em Atendimento', entradas: 0, conversaoProximaPct: null });
    expect(funil[1].conversaoProximaPct).toBe(0);
  });

  it('sem etapas / sem eventos', () => {
    expect(montarFunil([], [])).toEqual([]);
    expect(montarFunil(etapas, []).every((e) => e.entradas === 0)).toBe(true);
  });

  it('evento de etapa que nao e do pipeline e ignorado', () => {
    expect(montarFunil(etapas, [{ cardId: 'x', toStageId: 'outra' }]).every((e) => e.entradas === 0)).toBe(true);
  });
});
